+++
title = "How uv Works Under the Hood"
date = 2026-04-08
updated = 2026-11-02
description = "A walkthrough of uv's internals: the crate layout, what uv init and uv add do on disk, the two-thread resolver, PubGrub, batch prefetching, the forking resolver, and the cache."
draft = false
[taxonomies]
tags = ["python", "rust", "uv", "package-manager", "pubgrub", "dependency-resolution", "open-source", "tokio"]
categories = ["Engineering"]
+++

> *Updated 2026-11-02: re-verified against uv v0.13.6; uv 0.13 was another breaking release, so I re-captured the outputs for `uv init`, `uv add`, the lockfile, the fork example and the cache layout. The earlier version also had a few things wrong, most notably the DashMap claim and the cache being content-addressed, plus a couple of smaller ones; those are fixed below.*
>
> *Updated 2026-08-04: re-verified against uv v0.12.1. The uv 0.12 release changed the `uv init` default — new projects are now packaged, with a `src/` layout and a build system — so Section 3 and parts of Section 4 have been rewritten. I also refreshed the source links, crate counts, and the PyPI numbers in Section 8. The resolver internals (Sections 5-7) survived the 0.12 breaking release untouched, which says something about how stable that architecture is.*
>
> *Updated 2026-05-05: re-verified against uv v0.11.8. I refreshed the release references, fixed inconsistent package versions in the lockfile excerpt, updated build backend examples, and cleaned up punctuation/style issues.*

I started using [uv](https://github.com/astral-sh/uv) because the benchmarks seemed too good to be true: 10-100x faster than `pip`, resolves and installs in milliseconds. So I spent a weekend reading the source. This post is what I wish I'd had on day one.

It traces every layer: the repository structure, what actually happens when you type `uv init` or `uv add requests`, and the Rust concurrency patterns the resolver uses. No prior Rust experience needed, but if you've seen Rust before I'll point to the specific patterns in the source.

Everything below was verified against uv [v0.13.6](https://github.com/astral-sh/uv/releases/tag/0.13.6) (October 2026). Specific numbers and code excerpts come from that tag; if you're reading this much later, the line numbers in linked source files may have drifted, but the high-level architecture has been stable for many releases. The outputs were captured on an Apple Silicon Mac, starting from an empty cache. uv was told to use only its own managed Pythons, none of which were installed yet (the Mac itself has a Python; uv ignored it). That made it look like a fresh machine. Timings are from one run on my machine and my network; I would not read much into them.

Quick release notes. [uv 0.12](https://github.com/astral-sh/uv/releases/tag/0.12.0) (late July 2026) was a breaking release whose headline change was `uv init` creating packaged projects by default, which Section 3 covers. [uv 0.13.0](https://github.com/astral-sh/uv/releases/tag/0.13.0) (2026-10-09) is another one. Its breaking changes:

- The default stable Python is now 3.15 (was 3.14). This affects which Python gets downloaded when no version is requested or pinned; uv still uses compatible Pythons that are already installed.
- `--require-hashes` inside an included constraints file is now honored. Editable (`-e`) requirements in included constraints files are now rejected, matching pip.
- A stricter tar backend, `tar-codec`, is the default for reading tar archives. Opt out with `UV_LEGACY_TAR_BACKEND=1` (more in Section 10).
- New virtual environments on Python 3.10 and later no longer get the `_virtualenv.pth` distutils patch, which reduces Python startup overhead.
- On Windows ARM64, uv now prefers native ARM64 Python over emulated x86_64.
- The cache entry format changed, so uv may download or rebuild dependencies once after upgrading (Section 9).

The 0.13.0 notes say "We expect most users to be able to upgrade without making changes." On the security side, [0.13.4](https://github.com/astral-sh/uv/releases/tag/0.13.4) addresses [GHSA-hq85-5cpj-mr62](https://github.com/astral-sh/uv/security/advisories/GHSA-hq85-5cpj-mr62) (severity high): intermediate certificates issued by the `emSign ECC Root CA - G3` root are considered compromised, and 0.13.4 removes that root from uv's bundled CA certificates. If you use uv's bundled certificates (the default), upgrade to 0.13.4 or later. The advisory also says this is ecosystem-wide: anything that vendors a CA bundle, like `certifi`, needs updating too. Earlier, [0.12.18](https://github.com/astral-sh/uv/releases/tag/0.12.18) fixed [GHSA-2cv4-cqwr-gwf7](https://github.com/astral-sh/uv/security/advisories/GHSA-2cv4-cqwr-gwf7), a path traversal through wheel extraction that only affects Windows (severity medium). And since [0.12.12](https://github.com/astral-sh/uv/releases/tag/0.12.12), the release executables are code-signed: macOS binaries signed and notarized by Apple, Windows binaries with Authenticode signatures.

None of this changes the resolver design described here. What did change is internal: the crates were reorganised (Section 2), and the solver now talks to the fetcher through a new handle type (Section 5).

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

It has 91k+ stars (91,454 on 2026-11-02, from the GitHub API) and is used in production at scale. The underlying [`pubgrub-rs`](https://github.com/pubgrub-rs/pubgrub) crate it depends on is the [designated basis for Cargo's next dependency solver](https://rust-lang.github.io/rust-project-goals/2025h1/pubgrub-in-cargo.html). The same algorithm and largely the same Rust crate will eventually power both `uv` and `cargo` resolutions.

---

## 2. The repository layout

Clone the repo and you'll see:

```txt
uv/
├── crates/          # All Rust source code
├── docs/            # MkDocs documentation
├── python/          # Small Python shim package (the uv PyPI wheel)
├── scripts/         # Benchmarking, release tooling
├── test/            # Test fixtures, requirement files for benchmarks
├── Cargo.toml       # Rust workspace root
└── pyproject.toml   # uv manages itself with uv
```

The real action is in `crates/`. There are 91 crate directories in v0.13.6, up from 71 in v0.12.1. Most of the growth is a split. The CLI commands moved out of the `uv` binary crate into crates like `uv-project-commands` and `uv-pip-commands`. `uv-python` was split into `uv-python-discovery`, `uv-python-interpreter`, `uv-python-managed` and `uv-python-types`. The lockfile code got its own `uv-lock`, and the TOML editing moved into `uv-project-edit`. I have not looked into why they split it up, so I will not guess. Rust does not allow circular dependencies between crates, so the uv team structured the code as a directed acyclic graph of focused crates. Each does one thing:

```txt
crates/
├── uv/                    # CLI binary: the entry point
├── uv-cli/                # Command-line argument definitions (clap)
├── uv-project-commands/   # uv init, add, lock, sync, run, tree, ...
├── uv-pip-commands/       # Commands for inspecting and modifying Python environments
├── uv-project-edit/       # Edits pyproject.toml while preserving TOML formatting
├── uv-lock/               # Parsing, validation, traversal, and export of lockfiles
├── uv-resolver/           # Dependency resolution engine (PubGrub)
├── uv-installer/          # Installing packages into environments
├── uv-client/             # Async HTTP client for PyPI and registries
├── uv-workspace/          # pyproject.toml parsing and workspace discovery
├── uv-python-discovery/   # Finding and selecting a Python installation
├── uv-python-managed/     # Downloading and maintaining uv-managed Pythons
├── uv-cache/              # The global cache
├── uv-distribution/       # Wheel and sdist handling, metadata fetching
├── uv-build/              # uv's own build backend (replaces setuptools/hatchling)
├── uv-git/                # Git dependency support (based on Cargo's implementation)
├── uv-platform-tags/      # Wheel compatibility tag matching
├── uv-pep440/             # Python version specifier parsing (PEP 440)
├── uv-pep508/             # Dependency specifier parsing (PEP 508)
├── uv-types/              # Shared type definitions used across crates
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

This is still the step uv 0.12 changed most. uv had no managed Python installed yet, and it was told to ignore the system one. So `uv init my-project` started by downloading CPython 3.15.2, since 0.13 made 3.15 the default stable Python:

```txt
$ uv init my-project
Downloading cpython-3.15.2-macos-aarch64-none (download) (26.5MiB)
 Downloaded cpython-3.15.2-macos-aarch64-none (download)
Initialized project `my-project` at `/private/tmp/my-project`
```

With the interpreter in place, uv wrote these files to disk:

```txt
my-project/
├── .gitignore
├── .python-version    # "3.15" on this machine
├── README.md
├── pyproject.toml
└── src/
    └── my_project/
        └── __init__.py    # main() prints "Hello from my-project!"
```

The generated `pyproject.toml`:

```toml
[project]
name = "my-project"
version = "0.1.0"
description = "Add your description here"
readme = "README.md"
requires-python = ">=3.15"
dependencies = []

[project.scripts]
my-project = "my_project:main"

[build-system]
requires = ["uv_build>=0.13.6,<0.14.0"]
build-backend = "uv_build"
```

A few things to notice. The layout is `src/`-based, and the project is a real installable package from day one. With the `[project.scripts]` entry point, `uv run my-project` works out of the box. And the `[build-system]` points to `uv_build`, uv's own Rust-native build backend.

The `requires-python = ">=3.15"` and the `.python-version` of `3.15` come from the interpreter uv just downloaded. On a machine that already has, say, Python 3.12, uv uses that one instead; per the 0.13.0 notes, uv keeps using compatible installed Pythons. The build backend pin is `uv_build>=0.13.6,<0.14.0`. The upper bound follows uv's minor version, so a new minor release of uv means bumping that bound in existing projects; the 0.13.0 release notes ask for exactly that.

If you learned uv before 0.12 (or read an earlier version of this post), this is backwards from what you remember. The old default was a flat, *unpackaged* app: a `main.py` in the root and no `[build-system]` at all, meaning the project itself was never installed into the virtual environment. That default had a fair argument: applications don't need to be importable, and it avoided forcing a build-backend choice upfront. The new one has a fair argument too: unpackaged projects can't be depended on by anything else, and their entry-point ergonomics are worse. And now that Astral ships its own build backend, the "choosing a backend" friction is gone. In the source ([`init.rs`](https://github.com/astral-sh/uv/blob/0.13.6/crates/uv-project-commands/src/init.rs), now in the `uv-project-commands` crate) the default variant is still called `ApplicationWithLibrary`: an application *with* an importable package underneath.

The old behavior is still there: `uv init --no-package` gives you the flat `main.py` layout with no build system, and `--bare` gives you just a `pyproject.toml` and nothing else.

### Step 4: Git initialization

uv runs `git init` and writes a `.gitignore` that excludes `.venv/` and `__pycache__/`. Skip this with `--no-vcs`.

**No virtual environment is created yet.** uv is lazy: it creates `.venv` only when you first run something or add a package. This avoids disk writes for projects you might never use.

---

## 4. What happens when you run `uv add requests`

This is the core operation. `uv add` installs a package and records it in `pyproject.toml` and `uv.lock`. Here is the full pipeline:

```txt
$ uv add requests
Using CPython 3.15.2
Creating virtual environment at: .venv
Resolved 6 packages in 1.48s
   Building my-project @ file:///private/tmp/my-project
      Built my-project @ file:///private/tmp/my-project
Prepared 6 packages in 293ms
Installed 6 packages in 7ms
 + certifi==2026.10.23
 + charset-normalizer==3.5.2
 + idna==3.20
 + my-project==0.1.0 (from file:///private/tmp/my-project)
 + requests==2.34.2
 + urllib3==2.8.0
```

"Resolved 6 packages" is the project itself plus 5 dependencies. This time all 6 get installed, because the default project is now packaged: uv builds `my-project` with `uv_build` (the "Building" and "Built" lines) and installs it in editable mode. I checked: the package's `direct_url.json` says `"editable":true`, and there is a `my_project.pth` file in site-packages. Editable means changes under `src/` are picked up without reinstalling. The earlier version of this post showed a trace from a `--no-package` project, where only 5 packages got installed. And "Prepared" is uv's word for downloaded and unpacked into the cache, ready to be linked into the venv; the actual install step is only creating links, which is why it took 7ms.

### Stage 1: Read the project state (`uv-workspace`)

`uv-workspace` reads `pyproject.toml` and constructs an in-memory `Manifest`: the project name, existing dependencies, Python version constraint, workspace members, and overrides.

### Stage 2: Update `pyproject.toml` (`uv-project-edit`)

uv adds `requests` to the `dependencies` list in `pyproject.toml`. At this point it doesn't know the version yet, so it records it as a bare requirement. After resolution (Stage 3), it rewrites the specifier with the resolved version. The exact form depends on the `--bounds` flag; the default, `AddBoundsKind::Lower`, now lives in [`add_bounds.rs`](https://github.com/astral-sh/uv/blob/0.13.6/crates/uv-configuration/src/add_bounds.rs#L16-L19) in the `uv-configuration` crate, and it gives you a single lower bound:

```toml
dependencies = [
    "requests>=2.34.2",
]
```

This edit goes through the `uv-project-edit` crate ([`lib.rs`](https://github.com/astral-sh/uv/blob/0.13.6/crates/uv-project-edit/src/lib.rs)), whose own description is "Edit project and script metadata while preserving TOML formatting." Up to 0.12.1 this code lived in `uv-workspace` as `pyproject_mut.rs`. It does surgical TOML editing: it patches exactly the field it needs to change without reformatting anything else in the file. That matters because `pyproject.toml` often contains hand-written comments and deliberate ordering that a naive serialize and reserialize pass would wipe out.

### Stage 3: Resolution (`uv-resolver` + PubGrub)

The resolver answers: *"Which exact version of every package satisfies all constraints?"*

This is the most complex stage. We'll cover it in depth in sections 5 and 6. The output is a complete `(package, version)` assignment for every package in the dependency tree.

### Stage 4: Write `uv.lock`

The resolved set is serialized to `uv.lock`. This is a TOML file that records every package: its exact version, source URL, content hash, and its own dependencies. A real excerpt:

```toml
version = 1
revision = 5
requires-python = ">=3.15"

[[package]]
name = "requests"
version = "2.34.2"
source = { registry = "https://pypi.org/simple" }
dependencies = [
    { name = "certifi" },
    { name = "charset-normalizer" },
    { name = "idna" },
    { name = "urllib3" },
]
sdist = { url = "https://files.pythonhosted.org/packages/ac/c3/e2a2b89f2d3e2179abd6d00ebd70bff6273f37fb3e0cc209f48b39d00cbf/requests-2.34.2.tar.gz", hash = "sha256:f288924cae4e29463698d6d60bc6a4da69c89185ad1e0bcc4104f584e960b9ed", size = 142856, upload-time = "2026-05-14T19:25:27.735Z" }
wheels = [
    { url = "https://files.pythonhosted.org/packages/a0/f4/c67b0b3f1b9245e8d266f0f112c500d50e5b4e83cb6f3b71b6528104182a/requests-2.34.2-py3-none-any.whl", hash = "sha256:2a0d60c172f83ac6ab31e4554906c0f3b3588d37b5cb939b1c061f4907e278e0", size = 73075, upload-time = "2026-05-14T19:25:26.443Z" },
]

[[package]]
name = "urllib3"
version = "2.8.0"
source = { registry = "https://pypi.org/simple" }
sdist = { url = "https://files.pythonhosted.org/packages/e3/05/b17359e1cefb4f909b5e40b1b90a496d987258916dbbf88e842c729f510e/urllib3-2.8.0.tar.gz", hash = "sha256:63bf2ead4c879426ebf22ef2a781eeb4aa3b4ae798a0435506f8687fd5bb9b63", size = 458972, upload-time = "2026-09-15T19:29:36.253Z" }
wheels = [
    { url = "https://files.pythonhosted.org/packages/92/9d/c4e665119135114480843e7ab388fa94d8480650450e6f8e26b70d323a4c/urllib3-2.8.0-py3-none-any.whl", hash = "sha256:0cf3cae568d36aa9576b28dfb35f11328f1cb974ca7647d9475ebb86c75ac6e3", size = 135717, upload-time = "2026-09-15T19:29:34.577Z" },
]
```

The lockfile is **universal**: one `uv.lock` works on macOS, Linux, and Windows. It records all possible packages for all platforms using environment markers. When you install from the lockfile on a real machine, uv selects only the packages appropriate for that platform. This is a real improvement over `pip freeze` or `requirements.txt`, which are inherently platform-specific snapshots.

The hashes are for integrity verification when downloading. Each file entry also records its `size` and `upload-time`. (The earlier version of this post also claimed the hashes key the cache; that was not right for the default cache, see Section 9.)

> **Note:** `uv.lock` is an internal format that may change between versions. If you need to read it programmatically, the experimental `uv workspace metadata --preview-features workspace-metadata` command outputs a JSON view of the same dependency graph. It is still preview as of v0.13.6, and its output changed in 0.13.2 and again in 0.13.6, so don't rely on the schema being final.

### Stage 5: Download packages (`uv-client` + Tokio)

`uv-client` is uv's async HTTP client, built on [reqwest](https://github.com/seanmonstar/reqwest) and [Tokio](https://tokio.rs/). For every package not already in the global cache, uv fires off **concurrent downloads**:

```txt
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

Packages land in a global cache managed by `uv-cache`. It is shared across all your projects, and shared by `uv pip install` and `uv add` as well as by `uvx` tool installs.

One correction: the earlier version of this post said the cache key is the SHA-256 hash of the package content. By default that is not how it works. Unzipped wheels are stored in an `archive-v0` bucket under random IDs, and the wheel entries point at them. Content addressing exists, but only as a preview feature (Section 9). I also claimed the cache was verified by hash on every use; I had not checked that, so I removed the claim.

### Stage 6: Install packages (`uv-installer`)

"Install" normally implies copying files. uv mostly doesn't copy anything.

At 0.13.6 the default link mode is `clone` (copy-on-write) on macOS and Linux, and `hardlink` on other platforms such as Windows; that is spelled out in [`link.rs`](https://github.com/astral-sh/uv/blob/0.13.6/crates/uv-fs/src/link.rs#L39-L51). A clone shares the same data blocks as the cached file until one side is modified, so creating one is a filesystem metadata operation, not a byte copy.

If a clone fails, uv falls back to a hard link, and if that fails, to a plain copy: clone, then hardlink, then copy, spelled out in the [fallback code](https://github.com/astral-sh/uv/blob/0.13.6/crates/uv-fs/src/link.rs#L266-L281). You can pick the mode yourself with `--link-mode` or the `UV_LINK_MODE` environment variable; the values are `clone`, `copy`, `hardlink` and `symlink`.

Correction: the earlier version said uv uses hard links on most Linux and macOS filesystems. That was wrong; `clone` was already the default there in 0.11.8.

For a sense of the cost, look at the `uv add requests` trace above: the whole install step was `Installed 6 packages in 7ms`. That 7ms is the overhead of creating directory entries, not copying megabytes.

---

## 5. Inside the resolver: the two-thread architecture

The resolver is the most architecturally interesting part of uv, and the source code reveals a specific design decision that's worth understanding.

### The concurrency problem

The PubGrub algorithm is inherently **sequential and synchronous**: it makes one decision at a time, and each decision depends on all previous decisions. You cannot trivially parallelize it.

But metadata fetching (querying PyPI for "which versions of `flask` exist?" or "what does `flask==3.1.0` depend on?") is highly parallelizable I/O.

The naive approach is to serialize everything: decide package, fetch metadata, decide next package, fetch metadata. This is what pip does. uv does something cleverer.

### Two threads communicating via channels

The `resolve()` function in [`crates/uv-resolver/src/resolver/mod.rs`](https://github.com/astral-sh/uv/blob/0.13.6/crates/uv-resolver/src/resolver/mod.rs#L310-L344) is still short enough to quote verbatim. One difference from the 0.12.1 version: the solver no longer gets the raw channel sender; it gets a `MetadataRequests` handle that wraps it (more on that below):

```rust
pub async fn resolve(self) -> Result<ResolverOutput, ResolveError> {
    let state = Arc::new(self.state);
    let provider = Arc::new(self.provider);

    // A channel to fetch package metadata (e.g., given `flask`, fetch all versions) and version
    // metadata (e.g., given `flask==1.0.0`, fetch the metadata for that version).
    // Channel size is set large to accommodate batch prefetching.
    let (request_sink, request_stream) = mpsc::channel(300);
    let requests =
        MetadataRequests::new(state.index.clone(), request_sink, state.recorder.clone());

    // Run the fetcher.
    let requests_fut = state.clone().fetch(provider.clone(), request_stream).fuse();

    // Spawn the PubGrub solver on a dedicated thread.
    let solver = state.clone();
    let (tx, rx) = oneshot::channel();
    thread::Builder::new()
        .name("uv-resolver".into())
        .spawn(move || {
            let result = solver.solve(&requests);

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

```txt
┌─────────────────────────────────────────────┐
│  Dedicated sync thread: "uv-resolver"       │
│  Runs PubGrub solver (solve())              │
│  → Requests metadata via MetadataRequests   │
│  → Waits on registered InMemoryIndex entry  │
└──────────────────┬──────────────────────────┘
                   │ mpsc channel (capacity 300)
                   ▼
┌─────────────────────────────────────────────┐
│  Tokio async runtime                        │
│  Runs fetch() - handles request_stream      │
│  Fires concurrent HTTP requests             │
│  Writes results into InMemoryIndex          │
└─────────────────────────────────────────────┘
```

The solver thread is **synchronous**. PubGrub's algorithm doesn't fit naturally into async/await because it's a tight loop with complex mutable state. Running it on its own OS thread sidesteps the question entirely.

The fetcher runs on Tokio's async runtime. When the solver needs metadata for a package, it goes through [`MetadataRequests`](https://github.com/astral-sh/uv/blob/0.13.6/crates/uv-resolver/src/resolver/requests.rs#L19-L25), which the source describes as "A blocking solver-side handle for requesting metadata from the asynchronous fetcher." It holds the `InMemoryIndex` and the channel sender, plus an optional recorder.

Making a request registers the key in the index and sends a `Request` down the `mpsc` channel; what comes back is a handle. The solver then waits on that handle. The wait ends in [`wait_blocking()`](https://github.com/astral-sh/uv/blob/0.13.6/crates/uv-once-map/src/registered.rs#L150-L153), which is `futures::executor::block_on` over the per-key notifier. That blocks only the solver thread, not Tokio's runtime, which keeps happily making more network requests.

This handle is new since the last update; it arrived in two PRs in September 2026: [#21735](https://github.com/astral-sh/uv/pull/21735) "Encapsulate resolver metadata requests" and [#21798](https://github.com/astral-sh/uv/pull/21798) "Bind resolver metadata waits to registered request handles". Before #21798, a caller could register a request for one package and then wait on a different key by mistake; now the handle carries the package it was registered for. #21735's description notes that "The asynchronous provider and prefetch selection policies are unchanged."

This design separates concerns:

- PubGrub stays synchronous and simple.
- Network I/O stays async and concurrent.
- `Arc<ResolverState>` is shared safely between the two sides.
- The 300-deep `mpsc` channel provides backpressure: if the solver burns through requests faster than the fetcher can keep up, it eventually blocks on `send`.

### The `InMemoryIndex`

The `InMemoryIndex` is a shared cache of already-fetched metadata, built on uv's own `OnceMap` from the `uv-once-map` crate. The solver reads from it; the fetcher writes to it. When a key is missing, the solver thread parks on that key's notifier until the fetcher writes the value in. The Tokio runtime is never blocked, so other in-flight downloads keep making progress.

I had this wrong before: the earlier version said the index is backed by `DashMap`. That was true until 0.11.21. [PR #19532](https://github.com/astral-sh/uv/pull/19532), merged 2026-06-18 and first released in 0.11.22, replaced DashMap with [`papaya`](https://github.com/ibraheemdev/papaya), and my 2026-08-04 update missed it. At 0.13.6 the map inside `OnceMap` is a `papaya::HashMap` ([`lib.rs`](https://github.com/astral-sh/uv/blob/0.13.6/crates/uv-once-map/src/lib.rs#L10)). papaya describes itself as "A fast and ergonomic concurrent hash-table for read-heavy workloads."

The reason for the swap, quoted from the PR: "`DashMap` has a lot of deadlock conditions. Our cases aren't about performance, but about concurrent access, and deadlocks are a bad experience for users (aka CI getting stuck for 6h until the hard job limit kills it)."

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

**3. Pick a version.** uv tries versions newest-to-oldest by default (or oldest-to-newest with `resolution = "lowest"`). It prefers versions already in `uv.lock` (making re-resolves stable) and versions already installed in the current environment (avoiding unnecessary upgrades). As of 0.12, pre-releases are handled "if necessary": stable candidates are tried first, and pre-releases are considered only when no stable version satisfies the active constraints — the same behavior as pip, and it means a transitive dependency that only ships pre-releases now resolves without any configuration. (0.12.1 added `--prerelease-package` if you want a different policy for one specific package.)

**4. Add requirements.** All requirements of the chosen version are added to the undecided set. uv sends prefetch requests for their metadata in the background (see BatchPrefetcher below).

**5. Detect conflicts.** If PubGrub detects that the chosen version creates a conflict, it identifies the incompatible pair, records the incompatibility clause, backtracks to before one of them was decided, and retries with the new constraint.

**6. Repeat or terminate.** If all packages have decided versions: success. If an incompatibility propagates back to the root: failure with an explanation.

### The conflict-priority heuristic

The `CONFLICT_THRESHOLD` constant in [`resolver/mod.rs`](https://github.com/astral-sh/uv/blob/0.13.6/crates/uv-resolver/src/resolver/mod.rs#L117-L118) is still set to `5`; since 0.12.1 it moved from line 98 to line 118, and nothing else changed:

```rust
/// The number of conflicts a package may accumulate before we re-prioritize and backtrack.
const CONFLICT_THRESHOLD: usize = 5;
```

The scenario it solves: package `A` has high priority and is decided first. Every version of `B` the resolver tries is immediately rejected due to a conflict with `A`. The resolver could exhaust all of `B`'s versions before realising the root cause is `A`'s chosen version, which is slow.

After 5 conflicts involving `A` and `B`, uv marks them as "highly conflicting" and promotes `B`'s priority above `A`'s. It then backtracks to before `A` was decided and tries `B` first. Deciding the constrained package first finds the correct solution much faster.

### Error messages

When resolution fails, PubGrub can reconstruct exactly *why* by walking the derivation tree of incompatibilities backwards from the root. Instead of `"conflicting requirements detected"`, you get something like:

```txt
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

The `BatchPrefetcher` in [`crates/uv-resolver/src/resolver/batch_prefetch.rs`](https://github.com/astral-sh/uv/blob/0.13.6/crates/uv-resolver/src/resolver/batch_prefetch.rs) is a targeted optimization for packages with many versions that cause a lot of backtracking. The canonical example is `boto3`/`botocore`/`urllib3`.

The problem: the resolver tries a version, fetches its metadata, discovers a conflict, then moves to the next version and repeats. For botocore, which has hundreds of releases, this can mean hundreds of sequential metadata round trips on a cold cache.

The fix: after the resolver has tried a few versions of a package, the `BatchPrefetcher` speculatively sends fetch requests for several upcoming versions ahead of time. The schedule lives in the [`should_prefetch`](https://github.com/astral-sh/uv/blob/0.13.6/crates/uv-resolver/src/resolver/batch_prefetch.rs#L145-L165) function. That function already existed at 0.12.1; it only moved within the file. The earlier version of this post quoted just its doc comment and the condition. What did change since 0.12.1: the prefetcher now sends its requests through the same `MetadataRequests` handle as the solver. The condition itself did not change:

```rust
/// After 5, 10, 20, 40 tried versions, prefetch that many versions to start early but not
/// too aggressive. Later we schedule the prefetch of 50 versions every 20 versions, this gives
/// us a good buffer until we see prefetch again and is high enough to saturate the task pool.
fn should_prefetch(&self, next: &PubGrubPackage) -> (usize, bool) {
    let PubGrubPackageInner::Package {
        name,
        kind: PackageNodeKind::Base,
        marker: MarkerTree::TRUE,
    } = &**next
    else {
        return (0, false);
    };

    let num_tried = self.tried_versions.get(name).map_or(0, FxHashSet::len);
    let previous_prefetch = self.last_prefetch.get(name).copied().unwrap_or_default();
    let do_prefetch = (num_tried >= 5 && previous_prefetch < 5)
        || (num_tried >= 10 && previous_prefetch < 10)
        || (num_tried >= 20 && previous_prefetch < 20)
        || (num_tried >= 20 && num_tried - previous_prefetch >= 20);
    (num_tried, do_prefetch)
}
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

```txt
numpy>=2,<3 ; python_version >= "3.11"
numpy>=1.16,<2 ; python_version < "3.11"
```

A naive resolver fails here, since Python only allows one installed version of any package. uv's resolver sees two `numpy` requirements with different environment markers and splits (forks) the resolution into independent sub-resolutions. I ran it for real with uv 0.13.6. I made a tiny project named `fork-demo` with `requires-python = ">=3.9"` and those two requirements, and ran `uv lock`. The verbose log said "Splitting resolution on fork-demo==0.1.0 over numpy into 2 resolutions with separate markers". Then the `>= 3.11` fork split again, because the newest numpy 2.x, `2.5.4`, requires Python `>=3.12`. uv solved four splits in total: `>= 3.11`, `>= 3.12`, `== 3.11.*` and `< 3.11`.

The result is three numpy versions in one lockfile: `1.26.4` for Python below 3.11; `2.4.6` for 3.11; `2.5.4` for 3.12 and later. Here is the top of the generated `uv.lock`:

```toml
version = 1
revision = 5
requires-python = ">=3.9"
resolution-markers = [
    "python_full_version >= '3.12'",
    "python_full_version == '3.11.*'",
    "python_full_version < '3.11'",
]

[[package]]
name = "fork-demo"
version = "0.1.0"
source = { virtual = "." }
dependencies = [
    { name = "numpy", version = "1.26.4", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version < '3.11'" },
    { name = "numpy", version = "2.4.6", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version == '3.11.*'" },
    { name = "numpy", version = "2.5.4", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version >= '3.12'" },
]
```

All three land in `uv.lock` tagged with their markers. When you install from the lockfile on a real machine, uv evaluates the markers against the actual Python version and installs only the matching package. The earlier version of this post showed two forks for the same input (numpy `2.5.1` and `1.26.4`); today the same input gives three, which I find a nice live example of the nested case.

Forks can be **nested**: a fork can itself be split on another marker, resulting in a tree of resolutions. Forks with identical packages are merged to keep the lockfile manageable. The fork points are recorded in `uv.lock` so that re-resolving produces stable, identical forks rather than recalculating them from scratch.

You can observe forking live:

```bash
uv lock -v 2>&1 | grep -E "(Splitting|Solving split|Split.*took)"
```

The 0.13 patch releases did a lot of performance work right around forks and markers. [0.13.2](https://github.com/astral-sh/uv/releases/tag/0.13.2) removed exponential work in how uv handles complex dependency markers, and cut resolver memory use for large dependency graphs and forks. 0.13.5 reduced peak memory when resolving across multiple environments, and 0.13.6 reduced peak memory when resolving large workspaces. I have not measured any of it; the fork-demo example above is far too small to notice a difference.

### The metadata consistency assumption

uv makes one important assumption that enables a significant performance optimization: **all wheels of a single version of a package have identical `METADATA` files**.

Why this matters: as of 2026-11-02, numpy 2.5.4 on PyPI has exactly 65 wheels plus one source distribution. (2.5.1, the version the earlier text used, has 43.) Without the metadata consistency assumption, uv would need to fetch the metadata from each wheel separately. That is 65 network requests to understand one version of one package. With the assumption, uv fetches metadata from *any one* wheel and uses it for all platforms. uv prefers a wheel that exposes `.metadata` via [PEP 658](https://peps.python.org/pep-0658/). Otherwise, if the server supports HTTP range requests, uv downloads only the metadata at the end of the wheel. That turns 65 requests into 1.

One thing to watch: uv 0.13 has preview support for wheel variants, [PEP 825](https://peps.python.org/pep-0825/) "Wheel Variants: Package Format" (status: Provisional), behind the `wheel-variants` preview feature. 0.13.1 started parsing variant labels in wheel filenames; 0.13.5 added selecting and ranking variants; 0.13.6 added NVIDIA GPU detection. I have not tried it, and I do not know how variants interact with the assumption that all wheels of one version share the same METADATA.

The assumption holds for all major packages in practice. PEP 658 doesn't strictly require it, and there's been discussion about whether to mandate it, but uv's bet has paid off so far.

---

## 9. The global cache

The cache lives at (the [uv docs](https://github.com/astral-sh/uv/blob/0.13.6/docs/concepts/cache.md#L197-L198) list it, and `uv cache dir` prints it):

- `$XDG_CACHE_HOME/uv` or `$HOME/.cache/uv` on Unix, and that includes macOS
- `%LOCALAPPDATA%\uv\cache` on Windows

The earlier version of this post said `~/Library/Caches/uv` on macOS; that was wrong. On my Mac, `uv cache dir` printed a path under `~/.cache/uv`.

Here is the cache after the `uv add requests` run from Section 4, starting from an empty cache:

```txt
$ ls "$(uv cache dir)"
archive-v0
builds-v0
CACHEDIR.TAG
interpreter-v4
sdists-v10
simple-v27
wheels-v7
```

Each bucket name has a version suffix. The [cache docs](https://github.com/astral-sh/uv/blob/0.13.6/docs/concepts/cache.md#L212-L217) explain that each bucket is versioned, so if a release changes a bucket's format, uv will not read from or write to the incompatible old bucket. uv 0.13.0 bumped several of them (comparing `uv-cache` at 0.12.1 and 0.13.6): `wheels-v6` became `wheels-v7`; `sdists-v9` became `sdists-v10`; `simple-v24` became `simple-v27`. That is why 0.13 re-downloads things once after upgrading, and why the 0.13.0 notes can say several uv versions can still share one cache directory.

Here is what each bucket holds, from the doc comments in [`uv-cache`](https://github.com/astral-sh/uv/blob/0.13.6/crates/uv-cache/src/lib.rs#L1273-L1282):

- `wheels-v7`: wheels (excluding built wheels), with their metadata and cache policy
- `sdists-v10`: source distributions and the wheels built from them, plus their extracted metadata
- `archive-v0`: unzipped wheels, stored as directories; this is what gets linked into a `.venv`
- `builds-v0`: "Ephemeral virtual environments used to execute PEP 517 builds and other operations."
- `interpreter-v4`: cached information about Python interpreters
- `simple-v27`: index responses from PyPI's simple API

Correction: the earlier version called this cache content-addressed, with packages stored and retrieved by their SHA-256 hash. By default they are not. In my run the `archive-v0` entries had random names like `2vT9h-pR--9ClBnY`. Two projects that use `requests==2.34.2` from the same index still share one cache entry, because the wheel entry points at the same archive.

Content addressing does exist, as the `content-addressed-cache` preview feature. [PR #19693](https://github.com/astral-sh/uv/pull/19693) (merged 2026-08-25) makes the archive ID a deterministic hash of the unpacked directory, a 24-character lowercase base-36 string. [PR #21327](https://github.com/astral-sh/uv/pull/21327) (merged 2026-08-31) goes further: every file is stored under its BLAKE3 hash in a new `files-v0` bucket. The files are hard linked into `archive-v0`, so identical files across different wheels are stored once. Trying it on a fresh cache:

```txt
$ uv pip install --preview-features content-addressed-cache requests
Resolved 5 packages in 2.59s
Prepared 5 packages in 260ms
Installed 5 packages in 4ms
 + certifi==2026.10.23
 + charset-normalizer==3.5.2
 + idna==3.20
 + requests==2.34.2
 + urllib3==2.8.0
$ ls "$(uv cache dir)"
archive-v0
CACHEDIR.TAG
files-v0
interpreter-v4
sdists-v10
simple-v27
wheels-v7
$ ls "$(uv cache dir)"/archive-v0
g6f815e8ktasd7j6bhh3yqum
kt84mjmxy2eeed77x5mca3jn
wcp4hzrsbqnq8el3rmhyvmsb
yw16sxfi8megxmilg3e8ht0i
zkg1i85w7bgj43at5a1zzl6a
```

That fresh cache had 107 file objects in `files-v0` for these five packages. I have not used the preview long enough to say whether it is worth turning on.

About the `simple-v27` bucket: it caches index responses, and uv revalidates them rather than refetching blindly. 0.13.0 made that revalidation faster by not rewriting unchanged payloads. Running `uv lock` a second time in the `my-project` example printed `Resolved 6 packages in 2ms`, which is too fast to have touched the network.

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

uv caches successfully built wheels in `sdists-v10`, next to the source distribution they came from. If you install the same source package again, even across projects, the build only runs once. Correction: the earlier version said they are cached in `~/.cache/uv/builds/`; that was wrong, and `builds-v0` only holds the throwaway build environments.

On a related note, 0.13.0 made `tar-codec` the default backend for reading tar archives ([PR #22094](https://github.com/astral-sh/uv/pull/22094)), with stricter validation. It may reject sdists containing hard links or unsupported tar extensions that older versions accepted, and sdists built by `uv_build` can have different bytes and hashes. You can opt out with `UV_LEGACY_TAR_BACKEND=1`; [0.13.1](https://github.com/astral-sh/uv/releases/tag/0.13.1) already restored support for sdists containing hard links or full-length tar user or group names. There is also a preview flag, `--require-build-hashes`, that requires hashes for build dependencies, including transitive ones. I have not hit any of the tar strictness myself.

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

**Sync and async coexist in the same process.** The resolver wants a synchronous PubGrub loop and a concurrent async fetcher in the same binary, sharing state through an `Arc` around the papaya-backed index. Rust gives you `std::thread::spawn` and `tokio::spawn` side by side, with `Arc` for what they share; you can pick the right execution model per subsystem, and the type checker keeps you honest about what crosses the boundary. In Python this hybrid is famously awkward (the GIL plus `asyncio` make it hard to mix the two cleanly), and in Go everything wants to be a goroutine.

**Concurrent shared state without runtime data races.** The `InMemoryIndex` is read from the solver thread and written from the Tokio runtime simultaneously. papaya is the data structure that makes this safe, but Rust's type system is what makes the safety *enforced*: you can't accidentally hand out a `&mut` reference across threads. A new example from 0.13: the handles from Section 5 borrow the `RegisteredOnceMap`, and removing an entry needs exclusive access, so code that removes an entry while a handle is still alive does not compile. The crate ships this as a doc test marked `compile_fail,E0502`:

```rust
use uv_once_map::RegisteredOnceMap;

let mut map = RegisteredOnceMap::<_, _>::default();
map.done("package", 42);
let entry = map.get_registered("package").expect("completed entry");
map.remove(&"package"); // Cannot remove entries while a handle borrows the map.
assert_eq!(entry.wait_blocking(), 42);
```

You can still write deadlocks or logic bugs, of course. The DashMap swap in Section 5 was about deadlocks, which the type system does not catch. But the class of two threads stomping on each other's memory doesn't compile.

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
- The surgical TOML editing code is much bigger than I expected: 2,564 lines in `pyproject_mut.rs` at 0.12.1 (the earlier "~1800 lines" was wrong), and 2,309 lines in `uv-project-edit`'s `lib.rs` at 0.13.6. Preserving user formatting turns out to be most of the work in any tool that round-trips human-edited config.
- The `BatchPrefetcher` doc comment doesn't quite match its code. Small thing, but it's the kind of detail that convinces you the rest is hand-written by people, not regenerated.
- The "metadata consistency" assumption (Section 8) feels load-bearing but is technically not guaranteed by any PEP. uv is essentially betting on a behaviour packaging tooling has converged on without ever standardising.

If you want to poke at any of this, start with [`crates/uv-resolver/src/resolver/mod.rs`](https://github.com/astral-sh/uv/blob/0.13.6/crates/uv-resolver/src/resolver/mod.rs) (the `resolve()` and `solve()` functions) and [`requests.rs`](https://github.com/astral-sh/uv/blob/0.13.6/crates/uv-resolver/src/resolver/requests.rs) (the `MetadataRequests` handle), then [`batch_prefetch.rs`](https://github.com/astral-sh/uv/blob/0.13.6/crates/uv-resolver/src/resolver/batch_prefetch.rs). After that, the rest of the codebase mostly explains itself.

---

## Further reading

- [uv resolver internals](https://docs.astral.sh/uv/reference/internals/resolver/): the official deep dive, written by the uv team; primary source for Section 6
- [PubGrub blog post by Natalie Weizenbaum](https://nex3.medium.com/pubgrub-2fb6470504f): the original algorithm explanation; very approachable
- [pubgrub-rs internals guide](https://pubgrub-rs-guide.pages.dev/internals/intro): the Rust implementation's own documentation
- [uv 0.13.0 release notes](https://github.com/astral-sh/uv/releases/tag/0.13.0): the full list of breaking changes, from the Python 3.15 default to the cache format change and `tar-codec`
- [uv 0.12.0 release notes](https://github.com/astral-sh/uv/releases/tag/0.12.0): the new `uv init` defaults
- [GHSA-hq85-5cpj-mr62](https://github.com/astral-sh/uv/security/advisories/GHSA-hq85-5cpj-mr62): the compromised root CA advisory; upgrade to 0.13.4 or later
- [uv resolver source: `resolver/mod.rs`](https://github.com/astral-sh/uv/blob/0.13.6/crates/uv-resolver/src/resolver/mod.rs): start here if you want to read the resolver code; `resolve()` is the entry point
- [uv resolver source: `resolver/requests.rs`](https://github.com/astral-sh/uv/blob/0.13.6/crates/uv-resolver/src/resolver/requests.rs): the `MetadataRequests` handle
- [uv resolver source: `batch_prefetch.rs`](https://github.com/astral-sh/uv/blob/0.13.6/crates/uv-resolver/src/resolver/batch_prefetch.rs): the `BatchPrefetcher` implementation
- [uv cache docs](https://github.com/astral-sh/uv/blob/0.13.6/docs/concepts/cache.md): cache location and bucket versioning
- [uv CONTRIBUTING.md](https://github.com/astral-sh/uv/blob/0.13.6/CONTRIBUTING.md): setup, testing, profiling, snapshot testing
- [Tokio async runtime](https://tokio.rs/): the async runtime underlying uv's concurrent I/O
- [papaya](https://github.com/ibraheemdev/papaya): the concurrent hash map behind `OnceMap` and the `InMemoryIndex`, replacing DashMap since PR #19532
- [insta snapshot testing](https://insta.rs/): the testing library used throughout uv's test suite
