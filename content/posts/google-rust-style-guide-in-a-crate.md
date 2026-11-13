+++
title = "Setting up a Rust crate for Google's style guide"
date = 2026-11-13
updated = 2026-11-13
description = "A tested setup for Google's Rust style guide on Rust 1.100.0: nightly rustfmt, a Clippy lints table, clippy.toml, a CI job, and the rules only a reviewer can check."
draft = false
[taxonomies]
tags = ["rust", "style-guide", "rustfmt", "clippy", "github-actions"]
categories = ["Programming"]
+++

> *Updated 2026-11-13: the example crates are now in a GitHub repo and the CI job has run there.*

With default Clippy on 1.100.0, my rule-breaking `gstyle` file got no warnings at all. Not one. In my [earlier post](@/posts/google-rust-style-guide-vs-official.md) I read Google's Rust style guide next to the official one, and this post is the practical side: I set up a small crate so that tools check as much of Google's guide as they can. You get a `rustfmt.toml`, a `[lints]` table for `Cargo.toml`, a `clippy.toml`, a CI workflow, and the honest list of what is left for a human. The example repo [nooscraft/rustgoogle](https://github.com/nooscraft/rustgoogle) holds the `gstyle` crate from this post at its root, plus the small experiment crates I mention along the way. Everything here was tested on 1.100.0, the current stable as of 2026-11-13, and on nightly-2026-11-12, on my Mac; the earlier post used 1.99.0.

## Formatting with a pinned nightly

Google's [formatting section](https://github.com/google/styleguide/blob/cceb297e93677c31053e5e75de6b701a9204fc03/rustguide.md?plain=1#L450-L470) says "Use the appropriate formatting tool" and then lists rustfmt options; a codebase may skip one "if they care about building on stable" and the option is not available there. [The use rule](https://github.com/google/styleguide/blob/cceb297e93677c31053e5e75de6b701a9204fc03/rustguide.md?plain=1#L325-L327), the one that says a `use` statement should import items from one module, notes that it corresponds to `imports_granularity = Module`. So my `rustfmt.toml` has the three options from that list, plus `imports_granularity` for the `use` rule:

```toml
max_width = 100
hex_literal_case = "Lower"
format_macro_matchers = true
imports_granularity = "Module"
```

`max_width = 100` is already rustfmt's default; I keep it so the file mirrors the guide's list. Stable 1.100.0 ships rustfmt 1.11.0, and `format_macro_matchers` and `imports_granularity` are still nightly-only there, same as on 1.99.0 in the earlier post. What I do instead: everything except formatting runs on stable, and one pinned nightly does only the formatting. Installing just rustfmt for that nightly is one command: `rustup toolchain install nightly-2026-11-12 --profile minimal --component rustfmt`.

Here is `cargo +nightly-2026-11-12 fmt --check` on a small sample file:

```text
$ cargo +nightly-2026-11-12 fmt --check
Diff in src/lib.rs:1:
 //! Formatting check.
 
-use std::{collections::HashMap, fmt::Write};
+use std::collections::HashMap;
+use std::fmt::Write;
 
 /// Mask for the low byte.
-pub const MASK: u32 = 0xFF;
+pub const MASK: u32 = 0xff;
 
 /// Squares a number.
 #[macro_export]
Diff in src/lib.rs:10:
 macro_rules! square {
-    ($x : expr) => {
+    ($x:expr) => {
         $x * $x
     };
 }
```

It splits the merged `use` line into two lines, lowercases `0xFF` to `0xff`, and tidies the macro matcher `$x : expr` into `$x:expr`. On the same file, stable rustfmt only made the hex change. And here is stable's `fmt --check` after the nightly formatting has been applied:

```text
$ cargo +nightly-2026-11-12 fmt
$ cargo +1.100.0 fmt --check
Warning: can't set `format_macro_matchers = true`, unstable features are only available in nightly channel.
Warning: can't set `imports_granularity = Module`, unstable features are only available in nightly channel.
$ echo $?
0
```

It prints its two warnings but exits with 0, so a contributor who only has stable installed does not fight the nightly formatting. The other direction is not safe: a merged `use` line passes the stable check and fails the nightly one, which is why the CI job runs the nightly check.

The fourth item in Google's formatting list, escapes for invisible characters in literals, has no rustfmt option. Clippy's `invisible_characters` lint is on by default (deny), and it rejected a zero-width space (U+200B) in a string literal. It let a zero-width joiner (U+200D) through, and U+200D is the example in Google's own guide, so that item stays with review.

## Lints in Cargo.toml

As the opening said, default Clippy on 1.100.0 stayed quiet on this file. The guide links seven Clippy lints by name. In a separate test, five of them fired with no configuration: `borrowed_box`, `ptr_arg`, `new_without_default`, `len_without_is_empty` and `should_implement_trait`. `exhaustive_enums` is off by default. `wrong_self_convention` is on by default but stayed quiet on a public method `into_vec(&self)`; the next section fixes that.

This is the `[lints]` table in my `Cargo.toml`:

```toml
[lints.rust]
missing_docs = "warn"

[lints.clippy]
wildcard_imports = "warn"
exhaustive_enums = "warn"
unwrap_used = "warn"
missing_assert_message = "warn"
missing_panics_doc = "warn"
string_add = "warn"
undocumented_unsafe_blocks = "warn"
```

Which guide rule each line stands for:

- `missing_docs`: the guide says to document public APIs, "potentially using the `missing_docs` lint".
- `wildcard_imports`: "Don't use glob imports".
- `exhaustive_enums`: mark public enums `#[non_exhaustive]`.
- `unwrap_used`: prefer `expect` over `unwrap`.
- `missing_assert_message`: use context strings in assertions.
- `missing_panics_doc`: the guide says "Always document panic cases".
- `string_add`: prefer `format!` over `+`.
- `undocumented_unsafe_blocks`: the guide wants a comment starting with `SAFETY:`.

The lints and the guide do not always say the same thing. `string_add` suggests `String::push_str()` in its message, while Google suggests `format!`. It also fires for joining just two strings (`a.to_string() + b`), while the guide only asks for `format!` when there are more than two.

`wildcard_imports` allows prelude imports and `pub use` re-exports, and it allows `use super::*` only in test modules ([wildcard_imports source](https://github.com/rust-lang/rust/blob/1.100.0/src/tools/clippy/clippy_lints/src/wildcard_imports.rs#L66-L75)). Google allows `use super::*` for any inline module, so a `use super::*` inside a plain `mod helpers` got flagged.

`missing_assert_message` skips test code. Its docs say "this lint ignores them as they would be too noisy" ([missing_assert_message source](https://github.com/rust-lang/rust/blob/1.100.0/src/tools/clippy/clippy_lints/src/missing_assert_message.rs#L17-L19)), so the messages in test asserts are up to you.

## clippy.toml for the rest

Three more settings live in `clippy.toml`:

```toml
# Google: "Use of `panic::catch_unwind` is prohibited in first-party Rust code."
disallowed-methods = [
    { path = "std::panic::catch_unwind", reason = "prohibited in first-party code by the style guide" },
]
# Google prefers expect over unwrap, but unwrap in tests is fine.
allow-unwrap-in-tests = true
# The default (true) keeps wrong_self_convention and 18 other lints quiet
# when the fix would change a public API.
avoid-breaking-exported-api = false
```

`disallowed-methods` bans `std::panic::catch_unwind`; Google says its use "is prohibited in first-party Rust code" ([catch_unwind rule](https://github.com/google/styleguide/blob/cceb297e93677c31053e5e75de6b701a9204fc03/rustguide.md?plain=1#L1748-L1769)). `allow-unwrap-in-tests = true` stops `unwrap_used` from flagging an `.unwrap()` inside the `#[cfg(test)]` module, which it did without the setting. And `avoid-breaking-exported-api = false` matters because the default is true, and the default keeps 19 lints quiet when the fix would change a public API, `wrong_self_convention` among them ([Clippy's config docs](https://github.com/rust-lang/rust/blob/1.100.0/src/tools/clippy/book/src/lint_configuration.md?plain=1#L407-L432)). With it set to false, the public `into_vec(&self)` finally got "methods called `into_*` usually take `self` by value".

Here is Clippy on the rule-breaking file with both config files in place:

```text
$ cargo +1.100.0 clippy --all-targets --message-format=short
src/lib.rs:3:5: warning: usage of wildcard import: help: try: `std::collections::HashMap`
src/lib.rs:6:1: warning: exported enums should not be exhaustive
src/lib.rs:12:1: warning: docs for function which may panic missing `# Panics` section
src/lib.rs:13:5: warning: used `unwrap()` on a `Result` value
src/lib.rs:17:1: warning: docs for function which may panic missing `# Panics` section
src/lib.rs:18:5: warning: assert without any message
src/lib.rs:23:5: warning: you added something to a string. Consider using `String::push_str()` instead
src/lib.rs:27:1: warning: docs for function which may panic missing `# Panics` section
src/lib.rs:29:5: warning: unsafe block missing a safety comment
src/lib.rs:34:5: warning: use of a disallowed method `std::panic::catch_unwind`
src/lib.rs:7:5: warning: missing documentation for a variant
src/lib.rs:8:5: warning: missing documentation for a variant
```

Every planted problem shows up, twelve warnings in total, including `missing_docs` for two undocumented enum variants. Adding `-D warnings` makes the same run exit with code 101.

## Exceptions with `#[expect]`

Google's rules have exceptions. Two-state enums may stay exhaustive; the guide lists "Enums with two states that could be Booleans" ([non_exhaustive rule](https://github.com/google/styleguide/blob/cceb297e93677c31053e5e75de6b701a9204fc03/rustguide.md?plain=1#L1352-L1368)). And `catch_unwind` is acceptable "as a defense in depth mechanism", as long as nothing relies on it.

I write these exceptions as `#[expect(..., reason = "...")]` instead of `#[allow]`. Here are the `Mode` enum and a `guarded` function, each with an expectation and a reason:

```rust
/// How a job runs.
#[expect(
    clippy::exhaustive_enums,
    reason = "two states that could be a bool; the guide allows these to stay exhaustive"
)]
pub enum Mode {
    /// Skip the slow checks.
    Fast,
    /// Run every check.
    Slow,
}

/// Last-resort guard around a plugin call.
#[expect(
    clippy::disallowed_methods,
    reason = "defense in depth only; the plugin API already returns errors instead of panicking"
)]
pub fn guarded(f: impl FnOnce() + std::panic::UnwindSafe) -> bool {
    std::panic::catch_unwind(f).is_ok()
}
```

The point of `#[expect]` over `#[allow]`: if the code changes and the lint no longer fires, the expectation itself fails. To see it happen, I added `#[non_exhaustive]` to `Mode`:

```text
$ cargo +1.100.0 clippy --all-targets -- -D warnings
error: this lint expectation is unfulfilled
 --> src/lib.rs:7:5
  |
7 |     clippy::exhaustive_enums,
  |     ^^^^^^^^^^^^^^^^^^^^^^^^
  |
  = note: two states that could be a bool; the guide allows these to stay exhaustive
  = note: `-D unfulfilled-lint-expectations` implied by `-D warnings`
  = help: to override `-D warnings` add `#[allow(unfulfilled_lint_expectations)]`

error: could not compile `gstyle` (lib) due to 1 previous error
error: could not compile `gstyle` (lib test) due to 1 previous error
```

Clippy stopped with "this lint expectation is unfulfilled" and printed the reason as a note. An exception cannot go stale quietly, and the reason sits right next to it.

## A CI job

GitHub's Ubuntu 24.04 runner image, version 20261111.370, lists Rustup 1.29.3 and Rust 1.99.1 with Rustfmt 1.10.0; Clippy is not in its list ([runner image readme](https://github.com/actions/runner-images/blob/ubuntu24/20261111.370/images/ubuntu/Ubuntu2404-Readme.md?plain=1#L139-L146)). So the workflow installs both toolchains itself, with `--profile minimal`. It has three checks: nightly rustfmt with `--check`, stable Clippy with `-D warnings`, and stable tests:

```yaml
name: style

on:
  push:
    branches: [main]
  pull_request:

env:
  STABLE: "1.100.0"
  NIGHTLY: "nightly-2026-11-12"

jobs:
  style:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7

      - name: Install toolchains
        run: |
          rustup toolchain install "$STABLE" --profile minimal --component clippy
          rustup toolchain install "$NIGHTLY" --profile minimal --component rustfmt

      - name: Format (nightly rustfmt, for the unstable options)
        run: cargo +"$NIGHTLY" fmt --check

      - name: Lint (stable clippy)
        run: cargo +"$STABLE" clippy --all-targets -- -D warnings

      - name: Test (stable)
        run: cargo +"$STABLE" test
```

It uses `ubuntu-24.04` instead of `ubuntu-latest`, because the runner-images repo announced that `ubuntu-latest` will use Ubuntu 26.04 in November 2026 ([announcement](https://github.com/actions/runner-images/issues/14748)).

I first ran the same commands from the `run` steps locally with bash. On the fixed crate every step passed, and on the rule-breaking one the Clippy step failed with 101. Then I pushed the crate and this exact workflow to the example repo, and the [first run on GitHub](https://github.com/nooscraft/rustgoogle/actions/runs/43425503473) passed every step: checkout, installing both toolchains, the nightly format check, Clippy and the tests. It ran on the same image version the readme above describes. Both pins, 1.100.0 and nightly-2026-11-12, have to be bumped by hand now and then.

## What only a reviewer can check

Lints check that something is there, not that it is any good. In a small test, Clippy accepted `.expect("failed")`, an assert whose message only repeats the condition ("port > 1024"), and `// SAFETY: trust me`. Google's unsafe rule wants a real technical justification, including the question "If the reason is performance, are there benchmarks?" ([unsafe rule](https://github.com/google/styleguide/blob/cceb297e93677c31053e5e75de6b701a9204fc03/rustguide.md?plain=1#L1212-L1229)).

Some rules have no Clippy lint at all, at least none I found after searching the lint list on 1.100.0:

- qualify calls to top-level functions with a module name
- "Import traits within function bodies"
- no combinator chains in the header of a `for` loop
- "Avoid abbreviations"

"Prefer enum over bool" comes close: `fn_params_excessive_bools` exists but is off by default, and in a test it only fired at four bool parameters ("more than 3 bools"). A single confusing bool is for the reviewer.

For "Don't omit patterns on non_exhaustive enums when matching", rustc has a `non_exhaustive_omitted_patterns` lint, but on 1.100.0 it reports "the `non_exhaustive_omitted_patterns` lint is unstable" ([tracking issue](https://github.com/rust-lang/rust/issues/89554)). And the guide itself says "Don't use unstable features."

What is left is the part about judgement. I have only tried all of this on the tiny `gstyle` crate, not on a real one, so let's see how it holds up once the code fights back.
