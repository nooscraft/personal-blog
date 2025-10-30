+++
title = "Redis, TLS, and Deadpool: When Dependency Versions Collide"
date = 2025-10-30
description = "A deep dive into version compatibility issues between redis, deadpool-redis, and TLS support in Rust—and why sometimes you need to stick with an older version."
[taxonomies]
categories = ["Programming"]
tags = ["rust", "redis", "deadpool", "tls", "dependency-management", "compatibility"]
[extra]
cover_image_static = "images/covers/redis-tls-deadpool-compatibility.png"
+++

### The Problem

I was working on a Rust project that uses Redis with TLS connections and a connection pool via `deadpool-redis`. Everything was working fine until I ran `cargo check` and saw this warning:

```
warning: the following packages contain code that will be rejected by a future version of Rust: redis v0.25.4
```

That's not something you want to see. It suggests your code will break in future Rust versions. So naturally, I tried to upgrade the `redis` crate to a newer version.

But here's where things got interesting—every single attempt to upgrade past `v0.25.4` broke the build. Not just small errors, but fundamental incompatibilities between the `redis` crate and `deadpool-redis`.

### What I Tried

I went through the versions systematically, testing each major release:

- **v0.26.x**: Broke immediately. Missing `TcpTls` variant in the `Tokio` enum, internal TLS types incomplete.
- **v0.27.x**: Same issues as v0.26.x. TLS support partially broken.
- **v0.28.x**: TLS types like `TlsConnParams` and `TcpTls` were still broken internally.
- **v0.29.x**: Now it requires a `connect_tcp_tls` trait that `deadpool-redis` doesn't implement.
- **v0.30.x, v0.31.x, v0.32.x**: All require the same `connect_tcp_tls` trait.

The pattern became clear: somewhere between v0.25.4 and v0.29.0, the `redis` crate changed how it handles TLS connections, and `deadpool-redis` hasn't caught up yet.

### The Root Cause

The issue is that `redis` v0.25.4 is the last version before `connect_tcp_tls` was introduced. This new trait-based approach is cleaner architecturally, but it requires connection pool libraries to implement this trait. `deadpool-redis` v0.14.0 was built against the older API and doesn't have this implementation.

Versions between v0.25.4 and v0.29.0 are in a transitional state—they have some TLS support but it's incomplete or broken.

### Current Status

After testing all these versions, I ended up staying with `redis v0.25.4`. Here's the working configuration:

**Cargo.toml:**

```toml
[dependencies]
redis = { version = "=0.25.4", features = ["tokio-comp", "tls-rustls", "connection-manager"] }
deadpool-redis = "0.14.0"
tokio = { version = "1", features = ["full"] }
tokio-rustls = "0.23.4"
rustls = "0.20.8"
```

**rust-toolchain.toml:**

```toml
[toolchain]
channel = "1.74.1"
```

The `=` prefix on the redis version pins it exactly to v0.25.4, preventing accidental upgrades. And pinning Rust to `1.74.1` helps avoid future compatibility warnings.

This setup works reliably:
- TLS over `rediss://` connections work with `tokio-rustls`
- Connection pooling via `deadpool-redis` functions correctly
- No compilation warnings or errors
- Stable and predictable behavior

### What to Avoid

If you're in a similar situation, avoid these version combinations:

- **redis v0.26.x–v0.28.x**: TLS support is broken or incomplete. You'll get compilation errors related to missing enum variants or broken TLS types.
- **redis >= v0.29.0 with deadpool-redis**: Won't compile because `deadpool-redis` doesn't implement the required `connect_tcp_tls` trait.
- **deadpool-redis v0.15+**: Currently not compatible with stable `redis` versions due to the same trait mismatch.

### Alternative Approach

If you really need a newer `redis` version, you have one option: drop `deadpool-redis` and use `redis`'s built-in `ConnectionManager` or switch to a different pooling library like `bb8`. But this means rewriting your connection pool code, which might not be worth it for most projects.

### The Future

The situation is temporary, but it's unclear when it will be resolved. The `deadpool-redis` maintainers need to either:
1. Implement the `connect_tcp_tls` trait for newer `redis` versions, or
2. Update their API to work with the new connection model

Until then, staying with `redis v0.25.4` and `deadpool-redis v0.14.0` is the most stable path forward. Yes, you'll see that deprecation warning, but it's better than having broken code.

### Bottom Line

Sometimes upgrading dependencies isn't the right move. In this case, the ecosystem has a compatibility gap between `redis` and `deadpool-redis`, and staying on the older version is the pragmatic choice. The warning is annoying, but it's not breaking anything right now—and when the ecosystem catches up, you can upgrade then.

If you're building a new project and need Redis with TLS and pooling, consider whether you can use `redis`'s built-in `ConnectionManager` instead of `deadpool-redis`. If you're maintaining an existing project, stick with what works: `redis v0.25.4` and `deadpool-redis v0.14.0`.

