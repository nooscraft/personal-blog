+++
title = "How uv Works Under the Hood"
date = 2026-04-08
updated = 2026-05-05
description = "A thorough walkthrough of uv's internals: the Rust crate architecture, what uv init actually does on disk, the two-thread resolver design, how PubGrub's CDCL algorithm works, batch prefetching, the forking resolver, and why these Rust-specific patterns make it 10-100x faster than pip."
draft = false
[taxonomies]
tags = ["python", "rust", "uv", "package-manager", "pubgrub", "dependency-resolution", "open-source", "tokio"]
categories = ["Engineering"]
+++

> *Updated 2026-05-05: re-verified against uv v0.11.8. I refreshed the release references, fixed inconsistent package versions in the lockfile excerpt, updated build backend examples, and cleaned up punctuation/style issues.*

I started using [uv](https://github.com/astral-sh/uv) because the benchmarks seemed too good to be true: 10-100x faster than `pip`, resolves and installs in milliseconds. So I spent a weekend reading the source. This post is what I wish I'd had on day one.

It traces every layer: the repository structure, what actually happens when you type `uv init` or `uv add requests`, and the Rust concurrency patterns the resolver uses. No prior Rust experience needed, but if you've seen Rust before I'll point to the specific patterns in the source.

Everything below was verified against uv [v0.11.8](https://github.com/astral-sh/uv/releases/tag/0.11.8) (April 2026). Specific numbers and code excerpts come from that tag; if you're reading this much later, the line numbers in linked source files may have drifted, but the high-level architecture has been stable for many releases.

Quick release note: 0.11.8 mostly shipped CLI, lockfile, and configuration improvements (`pip uninstall -y`, `UV_NO_PROJECT`, `UV_PYTHON_SEARCH_PATH`, and `exclude-newer` lock handling fixes). It did not materially change the resolver architecture discussed in this post.

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

It has 84k+ stars, is used in production at scale, and the underlying [`pubgrub-rs`](https://github.com/pubgrub-rs/pubgrub) crate it depends on is the [designated basis for Cargo's next dependency solver](https://rust-lang.github.io/rust-project-goals/2025h1/pubgrub-in-cargo.html). The same algorithm and largely the same Rust crate will eventually power both `uv` and `cargo` resolutions.

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

The real action is in `crates/`. There are 67 crate directories in v0.11.8. Rust does not allow circular dependencies between crates, so the uv team structured the code as a directed acyclic graph of focused crates. Each does one thing:

```
crates/
├── uv/                  # CLI binary: entry point and argument parsing (clap)
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

The shape of the graph is roughly: `uv` (the binary) sits at the top and depends on everything. `uv-types` sits near the bottom and depends on almost nothing. Code only flows downward; cycles are a hard compile error.

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
├── .python-version    # e.g., "3.12", pins the Python version
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

Notice there is **no `[build-system]`** section. Without it, the project is *not installable as a package*: it won't be installed into the virtual environment itself. This is the correct default for applications (web servers, scripts, CLIs); it avoids an unnecessary install step and the complexity of choosing a build backend upfront.

If you pass `--lib` or `--package`, uv adds a `src/` layout and a `[build-system]` pointing to `uv_build`, uv's own Rust-native build backend:

```toml
[build-system]
requires = ["uv_build>=0.11.8,<0.12"]
build-backend = "uv_build"
```

### Step 4: Git initialization

uv runs `git init` and writes a `.gitignore` that excludes `.venv/` and `__pycache__/`. Skip this with `--no-vcs`.

**No virtual environment is created yet.** uv is lazy: it creates `.venv` only when you first run something or add a package. This avoids disk writes for projects you might never use.

---

## 4. What happens when you run `uv add requests`

This is the core operation. `uv add` installs a package and records it in `pyproject.toml` and `uv.lock`. Here is the full pipeline:

```
$ uv add requests
Using CPython 3.12.10
Creating virtual environment at: .venv
Resolved 6 packages in 456ms
Prepared 5 packages in 451ms
Installed 5 packages in 4ms
 + certifi==2026.2.25
 + charset-normalizer==3.4.7
 + idna==3.11
 + requests==2.33.1
 + urllib3==2.6.3
```

Two things worth noticing about that output. "Resolved 6 packages" includes the project itself as a node in the dependency graph (your project + 5 transitive deps), but only 5 packages are *installed*: the project itself isn't installable here because there's no `[build-system]`. And "Prepared" is uv's word for "downloaded and unpacked into the cache, ready to be linked into the venv": the actual install step is just creating links, which is why it takes 4ms.

### Stage 1: Read the project state (`uv-workspace`)

`uv-workspace` reads `pyproject.toml` and constructs an in-memory `Manifest`: the project name, existing dependencies, Python version constraint, workspace members, and overrides.

### Stage 2: Update `pyproject.toml` (`pyproject_mut`)

uv adds `requests` to the `dependencies` list in `pyproject.toml`. At this point it doesn't know the version yet, so it records it as a bare requirement. After resolution (Stage 3), it rewrites the specifier with the resolved version. The exact form depends on the `--bounds` flag; the default (`AddBoundsKind::Lower` in [`pyproject_mut.rs`](https://github.com/astral-sh/uv/blob/0.11.8/crates/uv-workspace/src/pyproject_mut.rs)) is a single lower bound:

```toml
dependencies = [
    "requests>=2.33.1",
]
```

This edit goes through `uv-workspace`'s `pyproject_mut` module, which does **surgical TOML editing**: it patches exactly the field it needs to change without reformatting anything else in the file. That matters because `pyproject.toml` often contains hand-formatted sections, comments, and deliberate ordering that a naive serialize/reserialize pass would obliterate.

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
version = "2.33.1"
source = { registry = "https://pypi.org/simple" }
dependencies = [
    { name = "certifi" },
    { name = "charset-normalizer" },
    { name = "idna" },
    { name = "urllib3" },
]
sdist = { url = "https://files.pythonhosted.org/packages/5f/a4/98b9c7c6428a668bf7e42ebb7c79d576a1c3c1e3ae2d47e674b468388871/requests-2.33.1.tar.gz", hash = "sha256:18817f8c57c6263968bc123d237e3b8b08ac046f5456bd1e307ee8f4250d3517", size = 134120 }
wheels = [
    { url = "https://files.pythonhosted.org/packages/d7/8e/7540e8a2036f79a125c1d2ebadf69ed7901608859186c856fa0388ef4197/requests-2.33.1-py3-none-any.whl", hash = "sha256:4e6d1ef462f3626a1f0a0a9c42dd93c63bad33f9f1c1937509b8c5c8718ab56a" },
]

[[package]]
name = "urllib3"
version = "2.6.3"
source = { registry = "https://pypi.org/simple" }
dependencies = []
sdist = { url = "https://files.pythonhosted.org/packages/c7/24/5f1b3bdffd70275f6661c76461e25f024d5a38a46f04aaca912426a2b1d3/urllib3-2.6.3.tar.gz", hash = "sha256:1b62b6884944a57dbe321509ab94fd4d3b307075e0c2eae991ac71ee15ad38ed", size = 435556 }
wheels = [
    { url = "https://files.pythonhosted.org/packages/39/08/aaaad47bc4e9dc8c725e68f9d04865dbcb2052843ff09c97b08904852d84/urllib3-2.6.3-py3-none-any.whl", hash = "sha256:bf272323e553dfb2e87d9bfd225ca7b0f467b919d7bbd355436d3fd37cb0acd4" },
]
```

The lockfile is **universal**: one `uv.lock` works on macOS, Linux, and Windows. It records all possible packages for all platforms using environment markers. When you install from the lockfile on a real machine, uv selects only the packages appropriate for that platform. This is a real improvement over `pip freeze` or `requirements.txt`, which are inherently platform-specific snapshots.

The hashes serve two purposes: integrity verification when downloading, and cache lookup keying.

> **Note:** `uv.lock` is an internal format that may change between versions. If you need to read it programmatically, the experimental `uv workspace metadata --preview-features workspace-metadata` command outputs a stable JSON representation of the same dependency graph (it's still preview as of v0.11.8, so don't rely on its schema being final).

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
- The cache is verified by hash on every use; silent corruption is caught immediately.
- The cache is shared across `uv pip install`, `uv add`, and `uvx` tool installs.

### Stage 6: Install packages (`uv-installer`)

"Install" normally implies copying files. uv mostly doesn't copy anything.

`uv-installer` uses **hard links** wherever the filesystem supports them (most Linux and macOS filesystems do). A hard link means two directory entries point to the same physical data blocks on disk. Creating one is essentially free: a single filesystem metadata operation.

When uv "installs" a package into `.venv/lib/python3.12/site-packages/`, it's creating hard links from the global cache into the virtual environment. No bytes are duplicated. This is why you see timings like `Installed 43 packages in 208ms`: that 208ms is the overhead of creating thousands of directory entries, not copying gigabytes.

On filesystems that don't support cross-device hard links (e.g., home directory and temp on different mounts, or network filesystems), uv falls back to copy-on-write reflinks, then regular copies. But the common case is hard links.

---

## 5. Inside the resolver: the two-thread architecture

The resolver is the most architecturally interesting part of uv, and the source code reveals a specific design decision that's worth understanding.

### The concurrency problem

The PubGrub algorithm is inherently **sequential and synchronous**: it makes one decision at a time, and each decision depends on all previous decisions. You cannot trivially parallelize it.

But metadata fetching (querying PyPI for "which versions of `flask` exist?" or "what does `flask==3.1.0` depend on?") is highly parallelizable I/O.

The naive approach is to serialize everything: decide package, fetch metadata, decide next package, fetch metadata. This is what pip does. uv does something cleverer.

### Two threads communicating via channels

The `resolve()` function in [`crates/uv-resolver/src/resolver/mod.rs`](https://github.com/astral-sh/uv/blob/0.11.8/crates/uv-resolver/src/resolver/mod.rs#L250-L282) is short enough to quote verbatim:

```rust
pub async fn resolve(self) -> Result<ResolverOutput, ResolveError> {
    let state = Arc::new(self.state);
    let provider = Arc::new(self.provider);

    // A channel to fetch package metadata (e.g., given `flask`, fetch all versions) and version
    // metadata (e.g., given `flask==1.0.0`, fetch the metadata for that version).
    // Channel size is set large to accommodate batch prefetching.
    let (request_sink, request_stream) = mpsc::channel(300);

    // Run the fetcher.
    let requests_fut = state.clone().fetch(provider.clone(), request_stream).fuse();

    // Spawn the PubGrub solver on a dedicated thread.
    let solver = state.clone();
    let (tx, rx) = oneshot::channel();
    thread::Builder::new()
        .name("uv-resolver".into())
        .spawn(move || {
            let result = solver.solve(&request_sink);

            // This may fail if the main thread returned early due to an error.
            let _ = tx.send(result);
        })
        .unwrap();

    let resolve_fut = async move { rx.await.map_err(|_| ResolveError::ChannelClosed) };

    // Wait for both to complete.
    let ((), resolution) = tokio::try_join!(requests_fut, resolve_fut)?;

    state.on_complete();
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
│  Runs fetch() - handles request_stream      │
│  Fires concurrent HTTP requests             │
│  Writes results into Arc<InMemoryIndex>     │
└────────────────────────────────────────────┘
```

The solver thread is **synchronous**. PubGrub's algorithm doesn't fit naturally into async/await because it's a tight loop with complex mutable state. Running it on its own OS thread sidesteps the question entirely.

The fetcher runs on Tokio's async runtime. When the solver needs metadata for a package, it sends a `Request` down the `mpsc` channel and then looks up the `InMemoryIndex` (a `DashMap`-backed concurrent cache). If the result isn't there yet, the solver thread blocks on the index's per-key notifier. That blocks *only the solver thread*, not Tokio's runtime, which keeps happily making more network requests.

This design separates concerns:

- PubGrub stays synchronous and simple.
- Network I/O stays async and concurrent.
- `Arc<ResolverState>` is shared safely between the two sides.
- The 300-deep `mpsc` channel provides backpressure: if the solver burns through requests faster than the fetcher can keep up, it eventually blocks on `send`.

### The `InMemoryIndex`

The `InMemoryIndex` is a shared cache of already-fetched metadata, backed by `DashMap` (a concurrent hashmap that allows reads without locking the whole map). The solver reads from it; the fetcher writes to it. When a key is missing, the solver thread parks on a per-key notifier until the fetcher writes the value in. The Tokio runtime is never blocked, so other in-flight downloads keep making progress.

---

## 6. PubGrub: the dependency resolution algorithm

### Why this is hard

The resolver must answer: given a set of requirements (with version ranges), find one exact version for every package such that every package's requirements are also satisfied, recursively, for all transitive dependencies.

In the general case, this is equivalent to the [Boolean Satisfiability Problem](https://en.wikipedia.org/wiki/Boolean_satisfiability_problem) (SAT), which is NP-complete. Package ecosystems have thousands of packages and hundreds of versions each. Naive backtracking (try a version; if it conflicts, undo and try another) can be exponential.

### PubGrub's approach: conflict-driven clause learning

uv uses [pubgrub-rs](https://github.com/pubgrub-rs/pubgrub), the Rust implementation of [PubGrub](https://nex3.medium.com/pubgrub-2fb6470504f). PubGrub was [introduced in April 2018](https://nex3.medium.com/pubgrub-2fb6470504f) by Natalie Weizenbaum for Dart's `pub` package manager and has since been adopted by Bundler, Poetry, and now uv. It is a **conflict-driven clause learning (CDCL)** solver.

The old approach is: pick a version, try it, on conflict undo and try another. Worst case is exponential.

PubGrub's approach: when a conflict is found, *learn from it* by recording an **incompatibility clause**. The clause encodes which combination of package versions caused the conflict. Any future partial assignment that would trigger that same conflict is pruned immediately, without re-exploring.

Concrete example: the resolver discovers that `a==2.0` and `b==3.0` can't coexist (because they require conflicting versions of `c`). PubGrub records the incompatibility `{a==2.0, b==3.0}`. Any future partial solution containing both is ruled out by unit propagation, instantly. This turns exponential worst cases into manageable ones for realistic package graphs.

### The resolver loop

Here is how PubGrub runs in uv, from the [official internals documentation](https://docs.astral.sh/uv/reference/internals/resolver/):

**1. Initialize.** Create a virtual root package representing your project. It is the only "decided" package; everything else is undecided.

**2. Pick the highest-priority undecided package.** uv's priority order is roughly:

- URL dependencies (git, path, file): pinned, no version negotiation needed.
- Packages with `==` constraints: version is already determined.
- Packages flagged as "highly conflicting" (see below).
- Everything else, ordered by when first encountered (breadth-first traversal).

This ensures direct dependencies are decided before transitive ones.

**3. Pick a version.** uv tries versions newest-to-oldest by default (or oldest-to-newest with `resolution = "lowest"`). It prefers versions already in `uv.lock` (making re-resolves stable) and versions already installed in the current environment (avoiding unnecessary upgrades).

**4. Add requirements.** All requirements of the chosen version are added to the undecided set. uv sends prefetch requests for their metadata in the background (see BatchPrefetcher below).

**5. Detect conflicts.** If PubGrub detects that the chosen version creates a conflict, it identifies the incompatible pair, records the incompatibility clause, backtracks to before one of them was decided, and retries with the new constraint.

**6. Repeat or terminate.** If all packages have decided versions: success. If an incompatibility propagates back to the root: failure with an explanation.

### The conflict-priority heuristic

The `CONFLICT_THRESHOLD` constant in [`resolver/mod.rs`](https://github.com/astral-sh/uv/blob/0.11.8/crates/uv-resolver/src/resolver/mod.rs#L98) is set to `5`:

```rust
/// The number of conflicts a package may accumulate before we re-prioritize and backtrack.
const CONFLICT_THRESHOLD: usize = 5;
```

The scenario it solves: package `A` has high priority and is decided first. Every version of `B` the resolver tries is immediately rejected due to a conflict with `A`. The resolver could exhaust all of `B`'s versions before realising the root cause is `A`'s chosen version, which is slow.

After 5 conflicts involving `A` and `B`, uv marks them as "highly conflicting" and promotes `B`'s priority above `A`'s. It then backtracks to before `A` was decided and tries `B` first. Deciding the constrained package first finds the correct solution much faster.

### Error messages

When resolution fails, PubGrub can reconstruct exactly *why* by walking the derivation tree of incompatibilities backwards from the root. Instead of `"conflicting requirements detected"`, you get something like:

```
× No solution found when resolving dependencies:
╰─▶ Because my-project depends on flask>=3.0 and flask>=3.0 requires
    werkzeug>=3.0, my-project requires werkzeug>=3.0.
    And because legacy-lib==1.0 requires werkzeug<2.0, and my-project
    depends on legacy-lib==1.0, my-project's requirements are
    unsatisfiable.
```

This is the single feature most likely to make you fall in love with PubGrub. Modern pip has improved here too, but uv's errors come from the same derivation tree the solver actually used, so they're always faithful to what the algorithm did.

---

## 7. Batch prefetching: the boto3 optimization

The `BatchPrefetcher` in [`crates/uv-resolver/src/resolver/batch_prefetch.rs`](https://github.com/astral-sh/uv/blob/0.11.8/crates/uv-resolver/src/resolver/batch_prefetch.rs) is a targeted optimization for packages with many versions that cause a lot of backtracking. The canonical example is `boto3`/`botocore`/`urllib3`.

The problem: the resolver tries a version, fetches its metadata, discovers a conflict, tries the next version, fetches *its* metadata, discovers a conflict, and so on. For botocore, which has hundreds of releases, this can mean hundreds of sequential fetch-then-reject cycles on a cold cache.

The fix: after the resolver has tried a few versions of a package, the `BatchPrefetcher` speculatively sends fetch requests for several upcoming versions ahead of time. The schedule from the source ([line 178](https://github.com/astral-sh/uv/blob/0.11.8/crates/uv-resolver/src/resolver/batch_prefetch.rs#L162-L183)):

```rust
/// After 5, 10, 20, 40 tried versions, prefetch that many versions to start early but not
/// too aggressive. Later we schedule the prefetch of 50 versions every 20 versions, this gives
/// us a good buffer until we see prefetch again and is high enough to saturate the task pool.
let do_prefetch = (num_tried >= 5 && previous_prefetch < 5)
    || (num_tried >= 10 && previous_prefetch < 10)
    || (num_tried >= 20 && previous_prefetch < 20)
    || (num_tried >= 20 && num_tried - previous_prefetch >= 20);
```

(The doc comment promises "5, 10, 20, 40" but the code only checks 5, 10, 20 explicitly; the 40-and-beyond case is handled by the rolling `num_tried - previous_prefetch >= 20` clause. Same end result, but if you're reading the source it's worth noting the comment doesn't quite match the conditions.)

The prefetcher uses two strategies:

- **Compatible strategy**: prefetch versions within the current constraint range, from newest downward.
- **In-order strategy**: when the compatible range is exhausted, prefetch the next versions by release order, ignoring compatibility.

It avoids prefetching source distributions (which are expensive to build). These are heuristics, and they might prefetch versions that turn out to be irrelevant, but in the cold-cache botocore case they can turn hundreds of serial round trips into a handful of batched ones.

---

## 8. The forking resolver: one lockfile for all platforms

Most Python resolvers produce a platform-specific result. uv produces a **universal lockfile** using a forking resolver.

Consider:

```
numpy>=2,<3 ; python_version >= "3.11"
numpy>=1.16,<2 ; python_version < "3.11"
```

A naive resolver fails here, since Python only allows one installed version of any package. uv's resolver detects that the two requirements for `numpy` have **different environment markers** and splits (forks) the resolution into two independent sub-resolutions:

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

Why this matters: I just checked PyPI, and numpy 2.3.2 has exactly 73 wheels (for different Python versions, operating systems, and architectures) plus one source distribution. Without the metadata consistency assumption, uv would need to fetch the metadata from each wheel separately to understand that version's dependencies. That's 73 network requests for one version of one package.

With the assumption, uv fetches metadata from *any one* wheel (preferring whichever exposes `.metadata` via [PEP 658](https://peps.python.org/pep-0658/), or whichever supports HTTP range requests so only the wheel's metadata footer needs to be downloaded) and uses it for all platforms. That turns 73 requests into 1.

The assumption holds for all major packages in practice. PEP 658 doesn't strictly require it, and there's been discussion about whether to mandate it, but uv's bet has paid off so far.

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
- The integrity check is free: the hash *is* the key.
- Renaming or moving the cache is safe; nothing relies on the path.

**The `simple/` cache**: PyPI's "simple" index is just an HTML page listing all available versions of a package. uv caches these responses. When you re-resolve with an existing `uv.lock`, uv can often skip almost all PyPI queries: it knows which versions it selected last time, checks the `simple/` cache (revalidating with a conditional GET) for any newer versions, and in most cases (no new releases since last lock) produces an identical solution without hitting the network.

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

uv caches successfully built wheels in `~/.cache/uv/builds/` keyed by the sdist hash. If you install the same source package again, even across projects, the build only runs once.

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

The choice of Rust isn't aesthetic. Reading the resolver, two specific properties stand out as load-bearing for the design:

**Sync and async coexist in the same process.** The resolver wants a synchronous PubGrub loop and a concurrent async fetcher in the same binary, sharing state via `Arc<DashMap<…>>`. Rust gives you `std::thread::spawn`, `tokio::spawn`, and `Arc` as first-class equals; you can pick the right execution model per subsystem and the type checker keeps you honest about what crosses the boundary. In Python this hybrid is famously awkward (the GIL plus `asyncio` make it hard to mix the two cleanly), and in Go everything wants to be a goroutine.

**Concurrent shared state without runtime data races.** The `InMemoryIndex` is read from the solver thread and written from the Tokio runtime simultaneously. `DashMap` is the data structure that makes this safe, but Rust's type system is what makes the safety *enforced*: you can't accidentally hand out a `&mut` reference across threads. You can still write deadlocks or logic bugs, of course, but the class of "two threads stomping on each other's memory" simply doesn't compile.

The other usual Rust talking points (no GC pauses, zero-cost `async`, native `linkat()`) all apply too, but they're not specific to uv. The two above are the ones I'd point to as actually shaping the architecture.

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

The team labels beginner-friendly issues as [`good first issue`](https://github.com/astral-sh/uv/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22). These typically don't require deep resolver knowledge: improving error messages, handling edge cases in TOML parsing, adding missing CLI flags. The `bug` label is also a good source of contributions.

Before starting on anything not labeled `good first issue` or `bug`, comment on the issue first. The team has strong opinions on what uv should and shouldn't do, and they prefer to align on approach before implementation.

---

## What surprised me

A few things I didn't expect going in, in case they're useful as anchors when you read the source yourself:

- The solver is a *plain `std::thread::spawn`*, not a `tokio::task::spawn_blocking`. The hybrid isn't subtle; it really is "spawn an OS thread and hand it the channel sender."
- The `InMemoryIndex` blocking primitive (the per-key notifier the solver waits on) is what makes the "sync solver, async fetcher" split actually work. Without it the solver would either busy-wait or block the Tokio runtime, and you'd lose all the parallelism.
- `pyproject_mut` is a much bigger module than I expected (~1800 lines for surgical TOML edits). Preserving user formatting turns out to be most of the work in any tool that round-trips human-edited config.
- The `BatchPrefetcher` doc comment doesn't quite match its code. Small thing, but it's the kind of detail that convinces you the rest is hand-written by people, not regenerated.
- The "metadata consistency" assumption (Section 8) feels load-bearing but is technically not guaranteed by any PEP. uv is essentially betting on a behaviour packaging tooling has converged on without ever standardising.

If you want to poke at any of this, the entry points to read first are [`crates/uv-resolver/src/resolver/mod.rs`](https://github.com/astral-sh/uv/blob/0.11.8/crates/uv-resolver/src/resolver/mod.rs) (the `resolve()` and `solve()` functions) and [`batch_prefetch.rs`](https://github.com/astral-sh/uv/blob/0.11.8/crates/uv-resolver/src/resolver/batch_prefetch.rs). After that, the rest of the codebase mostly explains itself.

---

## Further reading

- [uv resolver internals](https://docs.astral.sh/uv/reference/internals/resolver/): the official deep dive, written by the uv team; primary source for Section 6
- [PubGrub blog post by Natalie Weizenbaum](https://nex3.medium.com/pubgrub-2fb6470504f): the original algorithm explanation; very approachable
- [pubgrub-rs internals guide](https://pubgrub-rs-guide.pages.dev/internals/intro): the Rust implementation's own documentation
- [uv resolver source: `resolver/mod.rs`](https://github.com/astral-sh/uv/blob/0.11.8/crates/uv-resolver/src/resolver/mod.rs): start here if you want to read the resolver code; `resolve()` is the entry point
- [uv resolver source: `batch_prefetch.rs`](https://github.com/astral-sh/uv/blob/0.11.8/crates/uv-resolver/src/resolver/batch_prefetch.rs): the `BatchPrefetcher` implementation
- [uv CONTRIBUTING.md](https://github.com/astral-sh/uv/blob/0.11.8/CONTRIBUTING.md): setup, testing, profiling, snapshot testing
- [Tokio async runtime](https://tokio.rs/): the async runtime underlying uv's concurrent I/O
- [DashMap](https://docs.rs/dashmap/latest/dashmap/): the concurrent hashmap used in `InMemoryIndex`
- [insta snapshot testing](https://insta.rs/): the testing library used throughout uv's test suite
