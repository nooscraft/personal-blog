+++
title = "How uv Works Under the Hood"
date = 2026-04-08
description = "A thorough walkthrough of uv's internals: the Rust crate architecture, what uv init actually does on disk, the two-thread resolver design, how PubGrub's CDCL algorithm works, batch prefetching, the forking resolver, and why these Rust-specific patterns make it 10–100x faster than pip."
draft = false
[taxonomies]
tags = ["python", "rust", "uv", "package-manager", "pubgrub", "dependency-resolution", "open-source", "tokio"]
categories = ["Engineering"]
+++

I started using [uv](https://github.com/astral-sh/uv) because the benchmarks seemed too good to be true—10–100x faster than `pip`, resolves and installs in milliseconds. After reading the source code and the official resolver internals documentation, I understand *why*, and the answers are more interesting than just "it's written in Rust."

This post traces every layer: from the repository structure, through what literally happens when you type `uv init` or `uv add requests`, down to the Rust concurrency patterns that make the resolver work. It's written for someone who wants to understand the engineering and might want to contribute. No prior Rust experience needed—but if you've seen Rust before, I'll point to the specific patterns in the source.

---

## 1. What uv is

uv is an **extremely fast Python package and project manager**, written in Rust and built by [Astral](https://astral.sh), the team behind [Ruff](https://github.com/astral-sh/ruff). It replaces most of your Python toolchain in one binary:

| Old tool | uv equivalent |
|---|---|
| `pip install` | `uv pip install` |
| `pip-compile` | `uv pip compile` |
| `virtualenv` / `venv` | `uv venv` |
| `pyenv` | `uv python install` |
| `pipx run` | `uvx` / `uv tool run` |
| `poetry` / `rye` | `uv init` + `uv add` |

It has 82k+ stars, is used in production at scale, and its dependency resolver is designated as the replacement for Cargo's own solver—which is a significant endorsement from the Rust ecosystem itself.

---

## 2. The repository layout

Clone the repo and you'll see:

```
uv/
├── crates/          # All Rust source code
├── docs/            # MkDocs documentation
├── python/          # Small Python shim package (the uv PyPI wheel)
├── scripts/         # Benchmarking, release tooling
├── test/            # Test fixtures, requirement files for benchmarks
├── Cargo.toml       # Rust workspace root
└── pyproject.toml   # uv manages itself with uv
```

The real action is in `crates/`. Rust does not allow circular dependencies between crates, so the uv team structured the code as a directed acyclic graph of focused crates. Each does one thing:

```
crates/
├── uv/                  # CLI binary — entry point, argument parsing (clap)
├── uv-resolver/         # Dependency resolution engine (PubGrub)
├── uv-installer/        # Installing packages into environments
├── uv-client/           # Async HTTP client for PyPI and registries
├── uv-workspace/        # pyproject.toml parsing and workspace discovery
├── uv-python/           # Python version management
├── uv-cache/            # Global content-addressed cache
├── uv-distribution/     # Wheel and sdist handling, metadata fetching
├── uv-build/            # uv's own build backend (replaces setuptools/hatchling)
├── uv-git/              # Git dependency support (based on Cargo's implementation)
├── uv-platform-tags/    # Wheel compatibility tag matching
├── uv-pep440/           # Python version specifier parsing (PEP 440)
├── uv-pep508/           # Dependency specifier parsing (PEP 508)
├── uv-types/            # Shared type definitions used across crates
└── ... (many more)
```

You can generate a visual dependency graph between crates:

```bash
cargo depgraph --dedup-transitive-deps --workspace-only | dot -Tpng > graph.png
```

The key insight: `uv` (the binary) sits at the top and depends on everything. `uv-types` sits near the bottom and depends on almost nothing. Code only flows downward—no cycles, by language enforcement.

---

## 3. What happens when you run `uv init`

Let's trace `uv init my-project` step by step through the codebase.

### Step 1: Argument parsing (`uv` crate)

The `uv` crate is the binary entry point. It uses [clap](https://github.com/clap-rs/clap) for argument parsing. When you run `uv init my-project`, clap matches the `init` subcommand and extracts the project name and any flags (`--lib`, `--app`, `--package`, `--bare`, `--build-backend`, etc.).

### Step 2: Workspace discovery (`uv-workspace`)

Before creating anything, uv checks whether you're already inside an existing workspace. It walks **up** the directory tree looking for a `pyproject.toml` with a `[tool.uv.workspace]` section. If you're inside one, the new project is registered as a workspace member automatically. If not, it creates a standalone project.

### Step 3: Scaffold project files

For `uv init my-project`, uv writes these files to disk:

```
my-project/
├── .python-version    # e.g., "3.12" — pins the Python version
├── README.md
├── main.py            # boilerplate main() function
└── pyproject.toml
```

The generated `pyproject.toml`:

```toml
[project]
name = "my-project"
version = "0.1.0"
description = "Add your description here"
readme = "README.md"
requires-python = ">=3.12"
dependencies = []
```

Notice there is **no `[build-system]`** section. Without it, the project is *not installable as a package*—it won't be installed into the virtual environment itself. This is the correct default for applications (web servers, scripts, CLIs). It avoids an unnecessary install step and the complexity of choosing a build backend upfront.

If you pass `--lib` or `--package`, uv adds a `src/` layout and a `[build-system]` pointing to `uv_build`—uv's own Rust-native build backend:

```toml
[build-system]
requires = ["uv_build>=0.11.4,<0.12"]
build-backend = "uv_build"
```

### Step 4: Git initialization

uv runs `git init` and writes a `.gitignore` that excludes `.venv/` and `__pycache__/`. Skip this with `--no-vcs`.

**No virtual environment is created yet.** uv is lazy—it creates `.venv` only when you first run something or add a package. This avoids disk writes for projects you might never use.

---

## 4. What happens when you run `uv add requests`

This is the core operation. `uv add` installs a package and records it in `pyproject.toml` and `uv.lock`. Here is the full pipeline:

```
$ uv add requests
Creating virtual environment at: .venv
Resolved 6 packages in 400ms
Installed 6 packages in 18ms
 + certifi==2025.1.31
 + charset-normalizer==3.4.1
 + idna==3.10
 + requests==2.32.3
 + urllib3==2.4.0
```

### Stage 1: Read the project state (`uv-workspace`)

`uv-workspace` reads `pyproject.toml` and constructs an in-memory `Manifest`: the project name, existing dependencies, Python version constraint, workspace members, and overrides.

### Stage 2: Update `pyproject.toml` (`pyproject_mut`)

uv adds `requests` to the `dependencies` list in `pyproject.toml`. At this point it doesn't know the version yet, so it records it as a bare requirement. After resolution (Stage 3), it rewrites the specifier with the resolved lower bound:

```toml
dependencies = [
    "requests>=2.32.3",
]
```

This edit goes through `uv-workspace`'s `pyproject_mut` module, which does **surgical TOML editing**—it patches exactly the field it needs to change without reformatting anything else in the file. This is important because `pyproject.toml` often contains hand-formatted sections, comments, and deliberate ordering that tools should not destroy.

### Stage 3: Resolution (`uv-resolver` + PubGrub)

The resolver answers: *"Which exact version of every package satisfies all constraints?"*

This is the most complex stage. We'll cover it in depth in sections 5 and 6. The output is a complete `(package, version)` assignment for every package in the dependency tree.

### Stage 4: Write `uv.lock`

The resolved set is serialized to `uv.lock`. This is a TOML file that records every package: its exact version, source URL, content hash, and its own dependencies. A real excerpt:

```toml
version = 1
requires-python = ">=3.12"

[[package]]
name = "requests"
version = "2.32.3"
source = { registry = "https://pypi.org/simple" }
dependencies = [
    { name = "certifi" },
    { name = "charset-normalizer" },
    { name = "idna" },
    { name = "urllib3" },
]
sdist = { url = "https://files.pythonhosted.org/packages/.../requests-2.32.3.tar.gz", hash = "sha256:55365417734eb18255590a9f9bf5f8f4a9a2e6bf7119580b895a78a75a4a8802", size = 131218 }
wheels = [
    { url = "https://files.pythonhosted.org/packages/.../requests-2.32.3-py3-none-any.whl", hash = "sha256:70761cfe03c773ceb22aa2f671b4757976145175cdfed9ef6f2eedb0a1600cf9" },
]

[[package]]
name = "urllib3"
version = "2.4.0"
source = { registry = "https://pypi.org/simple" }
dependencies = []
sdist = { url = "https://files.pythonhosted.org/packages/.../urllib3-2.4.0.tar.gz", hash = "sha256:...", size = 200288 }
wheels = [
    { url = "https://files.pythonhosted.org/packages/.../urllib3-2.4.0-py3-none-any.whl", hash = "sha256:..." },
]
```

The lockfile is **universal**: one `uv.lock` works on macOS, Linux, and Windows. It records all possible packages for all platforms using environment markers. When you install from the lockfile on a real machine, uv selects only the packages appropriate for that platform. This is a fundamental improvement over `pip freeze` or `requirements.txt`, which are inherently platform-specific snapshots.

The hashes serve two purposes: integrity verification when downloading, and cache lookup keying.

> **Note:** `uv.lock` is an internal format that may change between versions. If you need to read it programmatically, use `uv workspace metadata` instead—it outputs a stable JSON representation of the same dependency graph.

### Stage 5: Download packages (`uv-client` + Tokio)

`uv-client` is uv's async HTTP client, built on [reqwest](https://github.com/seanmonstar/reqwest) and [Tokio](https://tokio.rs/). For every package not already in the global cache, uv fires off **concurrent downloads**:

```
# pip: sequential
fetch requests → wait → fetch urllib3 → wait → fetch certifi → wait → ...
total ≈ N × round_trip_time

# uv: concurrent
fetch requests ─┐
fetch urllib3   ├── all in parallel
fetch certifi   ─┘
total ≈ 1 × round_trip_time (roughly)
```

This is the largest contributor to uv's cold-cache speed. Network I/O latency is the bottleneck, and parallelism makes it roughly constant regardless of the number of packages.

Packages are stored in a **global, content-addressed cache** managed by `uv-cache`. The cache key is the SHA-256 hash of the package content. This means:

- Any package version you have ever installed is reused across all your projects, forever.
- The cache is verified by hash on every use—silent corruption is caught immediately.
- The cache is shared across `uv pip install`, `uv add`, and `uvx` tool installs.

### Stage 6: Install packages (`uv-installer`)

"Install" normally implies copying files. uv mostly doesn't copy anything.

`uv-installer` uses **hard links** wherever the filesystem supports them (most Linux and macOS filesystems do). A hard link means two directory entries point to the same physical data blocks on disk. Creating a hard link is essentially free—it's a single filesystem metadata operation.

When uv "installs" a package into `.venv/lib/python3.12/site-packages/`, it's creating hard links from the global cache into the virtual environment. No bytes are duplicated. This is why you see timings like `Installed 43 packages in 208ms`—that 208ms is the overhead of creating ~thousands of directory entries, not copying gigabytes.

On filesystems that don't support cross-device hard links (e.g., home directory and temp on different mounts, or network filesystems), uv falls back to copy-on-write reflinks, then regular copies. But the common case is hard links.

---

## 5. Inside the resolver: the two-thread architecture

The resolver is the most architecturally interesting part of uv, and the source code reveals a specific design decision that's worth understanding.

### The concurrency problem

The PubGrub algorithm is inherently **sequential and synchronous**: it makes one decision at a time, and each decision depends on all previous decisions. You cannot trivially parallelize it.

But metadata fetching—querying PyPI for "which versions of `flask` exist?" or "what does `flask==3.1.0` depend on?"—is highly parallelizable I/O.

The naive approach is to serialize everything: decide package, fetch metadata, decide next package, fetch metadata. This is what pip does. uv does something cleverer.

### Two threads communicating via channels

Looking at [`crates/uv-resolver/src/resolver/mod.rs`](https://github.com/astral-sh/uv/blob/main/crates/uv-resolver/src/resolver/mod.rs), the `resolve()` function reveals the architecture:

```rust
pub async fn resolve(self) -> Result<ResolverOutput, ResolveError> {
    let state = Arc::new(self.state);
    let provider = Arc::new(self.provider);

    // Channel for sending fetch requests from solver → fetcher (capacity: 300).
    let (request_sink, request_stream) = mpsc::channel(300);

    // The async fetcher runs on the Tokio thread pool.
    let requests_fut = state.clone().fetch(provider.clone(), request_stream).fuse();

    // The PubGrub solver runs on a DEDICATED SYNCHRONOUS THREAD.
    let solver = state.clone();
    let (tx, rx) = oneshot::channel();
    thread::Builder::new()
        .name("uv-resolver".into())
        .spawn(move || {
            let result = solver.solve(&request_sink);
            let _ = tx.send(result);
        })
        .unwrap();

    let resolve_fut = async move { rx.await.map_err(|_| ResolveError::ChannelClosed) };

    // Run both until one completes (or errors).
    let ((), resolution) = tokio::try_join!(requests_fut, resolve_fut)?;
    resolution
}
```

The architecture is:

```
┌────────────────────────────────────────────┐
│  Dedicated sync thread: "uv-resolver"       │
│  Runs PubGrub solver (solve())              │
│  → Sends fetch requests via mpsc::Sender   │
│  → Receives results via InMemoryIndex       │
└──────────────────┬─────────────────────────┘
                   │ mpsc channel (capacity 300)
                   ▼
┌────────────────────────────────────────────┐
│  Tokio async runtime                        │
│  Runs fetch() — handles request_stream      │
│  Fires concurrent HTTP requests             │
│  Writes results into Arc<InMemoryIndex>     │
└────────────────────────────────────────────┘
```

The solver thread is **synchronous**. PubGrub's algorithm doesn't fit naturally into async/await because it's a tight loop with complex mutable state. Running it synchronously on a dedicated thread avoids the overhead of trying to make the solver async.

The fetcher runs on Tokio's async thread pool. When the solver needs metadata for a package, it sends a `Request` down the `mpsc` channel (capacity 300) and then checks the `InMemoryIndex` (a concurrent `DashMap`-backed cache). If the result isn't there yet, it parks and yields until the fetcher writes it in. The solver thread uses `wait_blocking()` which blocks *only that thread*, not the Tokio runtime.

This design separates concerns cleanly:
- PubGrub stays synchronous and simple.
- Network I/O stays async and concurrent.
- `Arc<ResolverState>` is shared safely between both sides.
- The `mpsc` channel with capacity 300 provides backpressure—the solver can queue up to 300 requests before it blocks.

### The `InMemoryIndex`

The `InMemoryIndex` is a shared cache of already-fetched metadata, backed by `DashMap` (a concurrent hashmap that allows reads without locking the whole map). The solver reads from it; the fetcher writes to it. The solver uses `wait_blocking()` to park itself if a result isn't in the index yet, without blocking the async runtime.

---

## 6. PubGrub: the dependency resolution algorithm

### Why this is hard

The resolver must answer: given a set of requirements (with version ranges), find one exact version for every package such that every package's requirements are also satisfied—recursively, for all transitive dependencies.

In the general case, this is equivalent to the [Boolean Satisfiability Problem](https://en.wikipedia.org/wiki/Boolean_satisfiability_problem) (SAT), which is NP-complete. Package ecosystems have thousands of packages and hundreds of versions each. Naive backtracking (try a version; if it conflicts, undo and try another) can be exponential.

### PubGrub's approach: conflict-driven clause learning

uv uses [pubgrub-rs](https://github.com/pubgrub-rs/pubgrub), the Rust implementation of [PubGrub](https://nex3.medium.com/pubgrub-2fb6470504f), invented by Natalie Weizenbaum for the Dart package manager in 2018. PubGrub is a **conflict-driven clause learning (CDCL)** solver.

**Old approach:** Pick a version. Try it. On conflict, undo and try another. Worst case: exponential.

**PubGrub's approach:** When a conflict is found, *learn from it* by recording an **incompatibility clause**. The clause encodes which combination of package versions caused the conflict. Any future state that would trigger that same conflict is pruned immediately, without re-exploring.

For example: the resolver discovers that `a==2.0` and `b==3.0` can't coexist (because they require conflicting versions of `c`). PubGrub records the incompatibility `{a==2.0, b==3.0}`. Any future partial solution containing both is instantly ruled out. This turns exponential worst cases into manageable ones for realistic package graphs.

### The resolver loop

Here is how PubGrub runs in uv, from the [official internals documentation](https://docs.astral.sh/uv/reference/internals/resolver/):

**1. Initialize.** Create a virtual root package representing your project. It is the only "decided" package; everything else is undecided.

**2. Pick the highest-priority undecided package.** uv's priority order is:
- URL dependencies (git, path, file) — pinned; no version negotiation needed.
- Packages with `==` constraints — version is already determined.
- Packages flagged as "highly conflicting" (see below).
- Everything else, ordered by when first encountered (breadth-first traversal).

This ensures direct dependencies are decided before transitive ones.

**3. Pick a version.** uv tries versions newest-to-oldest by default (or oldest-to-newest with `resolution = "lowest"`). It prefers versions already in `uv.lock` (making re-resolves stable) and versions already installed in the current environment (avoiding unnecessary upgrades).

**4. Add requirements.** All requirements of the chosen version are added to the undecided set. uv sends prefetch requests for their metadata in the background (see BatchPrefetcher below).

**5. Detect conflicts.** If PubGrub detects that the chosen version creates a conflict, it identifies the incompatible pair, records the incompatibility clause, backtracks to before one of them was decided, and retries with the new constraint.

**6. Repeat or terminate.** If all packages have decided versions: success. If an incompatibility propagates back to the root: failure with an explanation.

### The conflict-priority heuristic

The `CONFLICT_THRESHOLD` constant in the source is set to `5`:

```rust
/// The number of conflicts a package may accumulate before we re-prioritize and backtrack.
const CONFLICT_THRESHOLD: usize = 5;
```

Here's the scenario it solves: Package `A` has high priority and is decided first. Every version of `B` the resolver tries is immediately rejected due to conflict with `A`. The resolver exhausts all of `B`'s versions before realizing the root cause is `A`'s chosen version—this is slow.

After 5 conflicts involving `A` and `B`, uv marks them as "highly conflicting" and promotes `B`'s priority above `A`'s. It then backtracks to before `A` was decided and tries `B` first. Deciding the constrained package first finds the correct solution much faster.

### Error messages

When resolution fails, PubGrub can reconstruct exactly why. Instead of `"conflicting requirements detected"`, you get:

```
× No solution found when resolving dependencies:
╰─▶ Because my-project depends on flask>=3.0 and flask>=3.0 requires
    werkzeug>=3.0, my-project requires werkzeug>=3.0.
    And because legacy-lib==1.0 requires werkzeug<2.0, and my-project
    depends on legacy-lib==1.0, my-project's requirements are
    unsatisfiable.
```

PubGrub walks the incompatibility chain backward and turns it into a narrative. pip's error messages tell you *what* conflicted; PubGrub tells you *why*, package by package.

---

## 7. Batch prefetching: the boto3 optimization

The `BatchPrefetcher` in `crates/uv-resolver/src/resolver/batch_prefetch.rs` is a targeted optimization for packages with many versions that cause a lot of backtracking—the canonical example is `boto3`/`botocore`/`urllib3`.

The problem: the resolver tries a version, fetches its metadata, discovers a conflict, tries the next version, fetches *its* metadata, discovers a conflict... For botocore, which has hundreds of releases, this means hundreds of sequential fetch-then-reject cycles on a cold cache.

The fix: after the resolver has unsuccessfully tried 5 versions of a package, the `BatchPrefetcher` speculatively sends fetch requests for the *next 50 compatible versions* ahead of time. The schedule from the source:

```rust
// After 5, 10, 20, 40 tried versions, prefetch that many versions to start early
// but not too aggressive. Later, schedule the prefetch of 50 versions every 20
// versions—high enough to saturate the task pool.
let do_prefetch = (num_tried >= 5  && previous_prefetch < 5)
    || (num_tried >= 10 && previous_prefetch < 10)
    || (num_tried >= 20 && previous_prefetch < 20)
    || (num_tried >= 20 && num_tried - previous_prefetch >= 20);
```

The prefetcher uses two strategies:

- **Compatible strategy**: prefetch versions within the current constraint range, from newest downward.
- **In-order strategy**: when the compatible range is exhausted, prefetch the next versions by release order, ignoring compatibility.

It avoids prefetching source distributions (which are expensive to build) and wheels that require building from source when there's no metadata available via range requests. These are heuristics—they might prefetch irrelevant versions—but in the cold-cache botocore case, they can turn hundreds of serial round trips into a handful of batched ones.

---

## 8. The forking resolver: one lockfile for all platforms

Most Python resolvers produce a platform-specific result. uv produces a **universal lockfile** using a forking resolver.

Consider:

```
numpy>=2,<3 ; python_version >= "3.11"
numpy>=1.16,<2 ; python_version < "3.11"
```

A naive resolver fails here—Python only allows one installed version of any package. uv's resolver detects that the two requirements for `numpy` have **different environment markers** and splits (forks) the resolution into two independent sub-resolutions:

- Fork 1: `python_version >= "3.11"` → resolves numpy to `2.3.0`
- Fork 2: `python_version < "3.11"` → resolves numpy to `1.26.4`

Both results land in `uv.lock` tagged with their markers. When you install from the lockfile on a real machine, uv evaluates the markers against the actual Python version and installs only the matching package.

Forks can be **nested**: a fork can itself be split on another marker, resulting in a tree of resolutions. Forks with identical packages are merged to keep the lockfile manageable. The fork points are recorded in `uv.lock` so that re-resolving produces stable, identical forks rather than recalculating them from scratch.

You can observe forking live:

```bash
uv lock -v 2>&1 | grep -E "(Splitting|Solving split|Split.*took)"
```

### The metadata consistency assumption

uv makes one important assumption that enables a significant performance optimization: **all wheels of a single version of a package have identical `METADATA` files**.

Why this matters: numpy 2.3.2 has 73 wheels (for different Python versions, operating systems, and architectures). Without the metadata consistency assumption, uv would need to fetch the metadata from each wheel separately to understand that version's dependencies. That's 73 network requests for one version of one package.

With the assumption, uv fetches metadata from *any one* wheel (preferring whichever supports range requests or exposes `.metadata` via PEP 658) and uses it for all platforms. This turns 73 requests into 1.

The assumption holds for all major packages in practice. The Python packaging standards don't formally require it, and there's ongoing discussion about whether to mandate it—but uv's bet has paid off.

---

## 9. The global cache

The cache lives at:
- `~/.cache/uv` on Linux
- `~/Library/Caches/uv` on macOS
- `%LOCALAPPDATA%\uv\cache` on Windows

Its structure:

```
~/.cache/uv/
├── wheels/        # Extracted wheels, keyed by content hash
├── sdists/        # Source distributions
├── builds/        # Wheels built from sdists (cached after first build)
├── interpreter/   # Python interpreter metadata (version, sysconfig, etc.)
└── simple/        # Cached PyPI "simple" index HTTP responses
```

**Content addressing**: packages are stored and retrieved by their SHA-256 hash, not by name or version. This means:

- Two projects using `requests==2.32.3` share one copy on disk.
- The integrity check is free—the hash is the key.
- Renaming or moving the cache is safe; nothing relies on the path.

**The `simple/` cache**: PyPI's "simple" index is just an HTML page listing all available versions of a package. uv caches these responses. When you re-resolve with an existing `uv.lock`, uv can often skip all PyPI queries—it knows which versions it selected last time, checks the `simple/` cache for any newer versions, and in most cases (no new releases since last lock) produces an identical solution without any network requests.

Manage the cache:

```bash
uv cache dir          # print the cache location
uv cache prune        # remove entries not referenced by any environment
uv cache clean        # remove all entries
```

---

## 10. Source distributions and the build sandbox

When a package only provides an sdist (no binary wheel for your platform), uv must build the wheel. This is handled by `uv-distribution`'s `DistributionDatabase`.

Building an sdist means running the package's build backend (e.g., setuptools, flit, hatchling) inside an isolated build environment. This is necessary because build scripts can run arbitrary Python code, and that code might read files, make network requests, or modify the filesystem.

uv caches successfully built wheels in `~/.cache/uv/builds/` keyed by the sdist hash. If you install the same source package again—even across projects—the build only runs once.

The contributing guide recommends building inside Docker if you're working with untrusted packages:

```bash
docker build -t uv-builder -f crates/uv-dev/builder.dockerfile --load .
docker run --rm -it -v $(pwd):/app uv-builder \
  /app/target/x86_64-unknown-linux-musl/profiling/uv-dev \
  resolve-many /app/scripts/popular_packages/pypi_10k_most_dependents.txt
```

This matters for uv's own development: if you're benchmarking the resolver against the 10k most popular PyPI packages, some of those sdists run code that could affect your system.

---

## 11. Why Rust, specifically

The Rust choice is not aesthetic. These are the concrete reasons it matters for uv's design:

### Synchronous solver + async I/O in one process

The resolver uses a dedicated synchronous thread for PubGrub and Tokio's async runtime for I/O, communicating via channels. This hybrid is natural in Rust: `thread::spawn` and `tokio::spawn` are both first-class, and `Arc<T>` makes shared state safe across the boundary. In Python, mixing threading and async is notoriously tricky; in Go, goroutines are all-async. Rust lets you choose the right execution model per subsystem.

### Compile-time data race prevention

uv fires hundreds of concurrent network requests. Shared state—the `InMemoryIndex`, the `unavailable_packages` map—is accessed from both the solver thread and the Tokio runtime. Rust's ownership and borrowing rules make **data races a compile error**. The `DashMap` type (a concurrent hashmap) is used specifically because it lets multiple threads read without exclusive locking, and Rust's type system ensures it's used correctly. If a developer accidentally introduced an unsynchronized shared write, the code wouldn't compile.

### No garbage collector pauses

uv's performance goal is sub-second resolution. Python, Java, and Go all have GCs that pause execution unpredictably. A 20ms GC pause in a 200ms operation is a 10% slowdown. Rust's memory is freed deterministically at the end of each value's scope (enforced by the compiler, zero runtime cost), so there are no GC pauses to worry about.

### Hard links and OS primitives

`uv-installer` calls `linkat()` to create hard links, which is a direct syscall with no interpreter overhead. In Rust, this is `std::fs::hard_link()` or the platform-specific `nix` crate—safe, efficient, and with the error handling enforced by the type system. In Python you'd use `os.link()`, which works, but you're going through the Python interpreter, the `os` module dispatch, and CPython's own memory management for every call.

### Zero-cost async/await

Tokio transforms `async fn` + `.await` into state machines at compile time. Each `.await` point is a state transition with no heap allocation and no virtual dispatch—the compiler generates exactly the code you'd write by hand in C if you were implementing the state machine yourself. This means uv can use thousands of concurrent async tasks (one per pending package fetch) without the overhead that would be prohibitive in languages where concurrency primitives have runtime costs.

---

## 12. Building from source and contributing

If you want to poke around or contribute:

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Clone
git clone https://github.com/astral-sh/uv.git && cd uv

# Build and run your local version
cargo run -- --version
cargo run -- pip install requests
cargo run -- venv

# Install the recommended test runner
cargo install cargo-nextest

# Run the full test suite
cargo nextest run

# Run a specific test
cargo nextest run -E 'test(test_add_requirement)'

# Update and review snapshot changes (uv uses insta for snapshot testing)
cargo install cargo-insta
cargo insta test --accept --test-runner nextest
```

### Snapshot testing with `insta`

uv's test suite makes heavy use of [insta](https://insta.rs/) for snapshot testing. A typical test looks like:

```rust
#[test]
fn test_add() {
    let context = TestContext::new("3.12");
    uv_snapshot!(context.filters(), context.add().arg("requests"), @"");
}
```

The `@""` at the end is a snapshot placeholder. The first time you run the test, insta captures the output. Subsequent runs compare against the snapshot. When behavior changes intentionally, you run `cargo insta review` to approve the updated snapshots. This makes it easy to catch unintended regressions in CLI output.

### Enabling logs

```bash
# High-level resolver decisions
RUST_LOG=uv=info cargo run -- pip compile requirements.in

# Resolver fork events specifically
RUST_LOG=uv_resolver=debug cargo run -- lock -v

# Everything (very verbose)
RUST_LOG=trace cargo run -- pip install requests
```

The `RUST_LOG` env var follows the `tracing` crate's directive syntax: you can scope it to specific crates (`uv_resolver=debug`), specific targets, or specific log levels.

### Finding a first contribution

The team labels beginner-friendly issues as [`good first issue`](https://github.com/astral-sh/uv/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22). These typically don't require deep resolver knowledge—improving error messages, handling edge cases in TOML parsing, adding missing CLI flags. The `bug` label is also a good source of contributions.

Before starting on anything not labeled `good first issue` or `bug`, comment on the issue first. The team has strong opinions on what uv should and shouldn't do, and they prefer to align on approach before implementation.

---

## Putting it all together

When you type `uv add requests`, every layer we covered fires in sequence:

1. **`uv` crate** parses arguments via clap.
2. **`uv-workspace`** reads `pyproject.toml`, discovers the workspace, builds the `Manifest`.
3. **`pyproject_mut`** surgically adds `requests` to `dependencies`.
4. **`uv-resolver`** calls `resolve()`:
   - The PubGrub solver starts on a **dedicated sync thread**, sending fetch requests via a Tokio `mpsc` channel (capacity 300).
   - The **async fetcher** on the Tokio runtime handles those requests, firing concurrent HTTP requests via `uv-client`/reqwest.
   - Fetched metadata lands in the shared `InMemoryIndex` (`DashMap`-backed).
   - **PubGrub** iterates: pick highest-priority undecided package → pick newest compatible version → add its requirements → detect conflicts → learn incompatibilities → repeat.
   - After 5 failed versions of a package, **`BatchPrefetcher`** speculatively fetches up to 50 upcoming versions.
   - If environment markers diverge (e.g., platform-specific requirements), the resolver **forks**, producing separate solutions tagged with markers.
5. The resolution is written to **`uv.lock`** as a universal, platform-tagged dependency graph.
6. **`uv-installer`** checks `uv-cache` for each package. Cache hits are **hard-linked** into `.venv/` instantly. Cache misses are downloaded concurrently, cached, then hard-linked.
7. Done. Warm cache: under 50ms. Cold cache on a fast connection: under two seconds for typical projects.

The speed is not magic. It is the accumulation of many specific engineering decisions, each grounded in either algorithmic improvement (CDCL vs. backtracking), systems programming (hard links, zero-cost async), or Rust's type system enforcing correctness of concurrent code that would be risky to write in other languages.

---

## Further reading

- [uv resolver internals](https://docs.astral.sh/uv/reference/internals/resolver/) — the official deep dive, written by the uv team; the primary source for Section 6
- [PubGrub blog post by Natalie Weizenbaum](https://nex3.medium.com/pubgrub-2fb6470504f) — the original algorithm explanation; very approachable
- [pubgrub-rs internals guide](https://pubgrub-rs-guide.pages.dev/internals/intro) — the Rust implementation's own documentation
- [uv resolver source: `resolver/mod.rs`](https://github.com/astral-sh/uv/blob/main/crates/uv-resolver/src/resolver/mod.rs) — start here if you want to read the resolver code; the `resolve()` function is the entry point
- [uv resolver source: `batch_prefetch.rs`](https://github.com/astral-sh/uv/blob/main/crates/uv-resolver/src/resolver/batch_prefetch.rs) — the `BatchPrefetcher` implementation
- [uv CONTRIBUTING.md](https://github.com/astral-sh/uv/blob/main/CONTRIBUTING.md) — setup, testing, profiling, snapshot testing
- [Tokio async runtime](https://tokio.rs/) — the async runtime underlying uv's concurrent I/O
- [DashMap](https://docs.rs/dashmap/latest/dashmap/) — the concurrent hashmap used in `InMemoryIndex`
- [insta snapshot testing](https://insta.rs/) — the testing library used throughout uv's test suite
