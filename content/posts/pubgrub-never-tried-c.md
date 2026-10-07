+++
title = "PubGrub never even tried c"
date = 2026-10-07
description = "A tiny dependency conflict in pubgrub 0.4.0, and the trace showing it proved there was no solution without ever picking a version of the package both sides wanted."
draft = false
[taxonomies]
tags = ["pubgrub", "rust", "dependency-resolution"]
categories = ["Engineering"]
+++

In my test, PubGrub proved there was no solution without ever picking a version of `c`, the contested package. I used `pubgrub` 0.4.0 with its offline provider: root depends on a and b, a depends on c 1, b depends on c 2, c has versions 1, 2.

```rust
deps.add_dependencies("root", 1u32, [("a", Ranges::singleton(1u32)), ("b", Ranges::singleton(1u32))]);
deps.add_dependencies("a", 1u32, [("c", Ranges::singleton(1u32))]);
deps.add_dependencies("b", 1u32, [("c", Ranges::singleton(2u32))]);
deps.add_dependencies("c", 1u32, []);
deps.add_dependencies("c", 2u32, []);
```

Running with `RUST_LOG=pubgrub=info` gives the solver's own log.

```text
unit_propagation: Id::<&str>(0) = 'root'
DP chose: Id::<&str>(0) = 'root' @ Some(1)
add_decision: Id::<&str>(0) @ 1 without checking dependencies
unit_propagation: Id::<&str>(0) = 'root'
DP chose: Id::<&str>(1) = 'a' @ Some(1)
add_decision: Id::<&str>(1) @ 1 without checking dependencies
unit_propagation: Id::<&str>(1) = 'a'
DP chose: Id::<&str>(2) = 'b' @ Some(1)
add_decision: Id::<&str>(2) @ 1 without checking dependencies
unit_propagation: Id::<&str>(2) = 'b'
Start conflict resolution because incompat satisfied:
       b 1 depends on c 2
prior cause: b 1, a 1 are incompatible
prior cause: b 1, root 1 are incompatible
prior cause: root 1 is forbidden
Because b 1 depends on c 2 and a 1 depends on c 1, a 1, b 1 are incompatible.
And because root 1 depends on a 1 and root 1 depends on b 1, root 1 is forbidden.
```

The solver decides root 1, a 1, b 1. There is no "DP chose" line for c. After b 1 it starts conflict resolution, learns "b 1, a 1 are incompatible", "b 1, root 1 are incompatible", "root 1 is forbidden", and stops. The last two lines are the error.

PubGrub stores everything as an incompatibility: terms that can't all be true. The [source comment](https://github.com/pubgrub-rs/pubgrub/blob/v0.4.0/src/internal/incompatibility.rs#L57-L64) says a@1 depends on b>=1,<2 becomes {a 1, b <1,>=2}. Once a 1 was decided, c was pinned to 1; when b 1 was decided, the conflict was true without picking c.

I expected it to try c 1, fail, then c 2. It never did. This is a toy; I have not traced real uv. Background in my [earlier post](@/posts/uv-how-it-works-under-the-hood.md).

Let's see in a real resolve.
