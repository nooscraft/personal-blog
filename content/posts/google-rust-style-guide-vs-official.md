+++
title = "Google's Rust style guide next to the official one"
date = 2026-11-12
description = "I read Google's new Rust style guide next to the official Rust Style Guide and tested a few of its rules on Rust 1.99.0: the rules I'd borrow, the funny bits, and the pushes I'd skip."
draft = false
[taxonomies]
tags = ["rust", "style-guide", "rustfmt", "clippy", "code-review"]
categories = ["Programming"]
+++

Google has a Rust style guide now: it appeared in the google/styleguide repo on 2026-10-21 ([first export commit](https://github.com/google/styleguide/commit/3cf4f72013826804b7442896ce84d3777cf89ae0), [rendered guide](https://google.github.io/styleguide/rustguide.html)), meant for Rust at Google: google3, Android, ChromeOS, Fuchsia and Chrome. One of its first rules says to follow the official public Rust style rules "to the extent they don't conflict" with it, which made me curious where the conflicts are. So I read the two guides side by side and tried a few of Google's rules on Rust 1.99.0 on my Mac. As of 2026-11-12 there have been six exports to that file, each titled "Automated export from internal guides", the latest on 2026-11-06.

## Not the same kind of document

The [official Rust Style Guide](https://doc.rust-lang.org/style-guide/) is a formatting document. It defines the default formatting style; rustfmt uses it as reference. A typical rule reads: "The maximum width for a line is 100 characters." ([that line, pinned to 1.99.0](https://github.com/rust-lang/rust/blob/1.99.0/src/doc/style-guide/src/README.md?plain=1#L50-L55)) Its only non-formatting page, "Other style advice", is 135 words by `wc -w` on the markdown: prefer expressions, naming cases, avoid `#[path]`.

Google's guide goes the other way: style, it says, includes guidance on API and implementation design. Its formatting section is about 194 words by `wc -w`, and most of it says: use the formatting tool (`git cl format` in Chromium) plus a list of rustfmt options. The rest is ownership, function inputs and outputs, errors, traits, naming, documentation, unsafe, concurrency. Its closer partner is the [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/), which Google also tells you to follow.

Some rules carry a codebase tag: `[chrome]`, `[Fuchsia]`, `[Android]`. No async/.await in Chromium, Fuchsia has its own mutex, Chrome tests use `rust_gtest_interop`. Not written for my side projects.

Both guides care about reading code without tools: the official principles ask for readability "without syntax highlighting or IDE assistance", and Google's glob-import rationale wants you to know where a type comes from in "contexts without xrefs". Same instinct, different vocabulary.

## The extra goal: Large-Scale Changes

Google says the guide shares the usual goals (consistency, readability, good API design) and adds one it calls "not seen as often": smoothing the way for Large-Scale Changes, or LSCs, codebase-wide refactorings done with tooling ([goals section](https://github.com/google/styleguide/blob/cceb297e93677c31053e5e75de6b701a9204fc03/rustguide.md?plain=1#L130-L141)).

That one goal explains many of the deviations. Why forbid glob imports? Because, quote, "Glob imports increase toil for code janitors running LSCs". I like that "code janitors" made it into the guide. The `#[non_exhaustive]` rules get an exception if you are committed to fixing the resulting breakages "via an LSC".

Two rationales admit, plainly, "This rule largely exists to avoid reviewer disagreements": one for qualifying top-level function calls with the module name, one for importing type names unqualified. Candour, not pretending a preference is science.

This is a guide for a codebase so large that tools and reviewers rewrite your code; many rules make sense from there and less in my three-crate side project. Context, not criticism. I have not applied the guide to anything large, and I have not used Chromium's tooling, no `git cl format`, no `chromium::import!()`, so all of this is reading plus small experiments.

## Rules I'd happily borrow

Some rules need no Google-scale justification:

- Prefer `expect` over `unwrap`: the message documents why the code thinks this cannot fail.
- Put real context in `assert!` messages: say why the assertion should hold or what went wrong. The guide's bad example has a message that only repeats the condition.
- Match instead of check-then-unwrap: `if let Some(value)` rather than `is_some()` followed by `unwrap()`.
- Pass an enum instead of a bool when the meaning is not obvious.
- Do not build a long iterator chain in a for loop header; bind it to a named variable first. The guide's example calls it `urgent_bugs`, and the name documents the chain.
- Unsafe code gets a comment starting with SAFETY: plus a technical justification, and the justification can cover a single block or a whole file or build target. The review question alone is worth stealing: "If the reason is performance, are there benchmarks?"
- API design rules are binding for library code and a strong recommendation for application code, which should "Avoid premature generalization and abstraction".

A good chunk of the guide is also "listen to Clippy" with more words. It links seven lints by name: `borrowed_box`, `ptr_arg`, `new_without_default`, `len_without_is_empty`, `should_implement_trait`, `wrong_self_convention` and `exhaustive_enums`. Much of it will look familiar if you already run Clippy.

## The funny bits

The rule "Qualify calls to top-level functions with a module name" uses, as its good example, possibly the scariest function in std: `mem::transmute`. Here is the guide's model snippet:

```rust
use std::mem;

let x = mem::transmute(y);
```

Yes, `mem::transmute`, which reinterprets the bits of one type as another, presented as the friendly face of import style. I pasted it into a real `main` on 1.99.0 and rustc stopped with E0133: the call needs an unsafe block. The same guide's unsafe rule says "Don't write unsafe code unless there is no way to implement the same functionality with safe code." The model citizen of the import section is a function the guide's own unsafe rule would make you justify in writing. ([rule](https://github.com/google/styleguide/blob/cceb297e93677c31053e5e75de6b701a9204fc03/rustguide.md?plain=1#L373-L392))

Then "Avoid abbreviations": "Don't abbreviate by deleting letters within a word." Exception: "Common abbreviations found in Wikipedia." I did not know Wikipedia was the appeals court for naming. Meanwhile the standard library ships `std::fmt` and `std::ptr`. To be fair, the rule covers names you invent, and std is much older. ([rule](https://github.com/google/styleguide/blob/cceb297e93677c31053e5e75de6b701a9204fc03/rustguide.md?plain=1#L1094-L1108))

The official guide has its own moment. On reserved words it says "Don't misspell the word", naming `krate` as the misspelling to avoid ([advice, pinned](https://github.com/rust-lang/rust/blob/1.99.0/src/doc/style-guide/src/advice.md?plain=1#L28-L30)). Open the [compiler source at tag 1.99.0](https://github.com/rust-lang/rust/tree/1.99.0/compiler) and the word `krate` appears 495 times in 93 files. I counted with `grep -w`. The compiler is older than the advice, to be fair. Still: 495.

In the error section, defects must be fixed in code, not handled at runtime, "although coarse-grained recovery might be possible with" `catch_unwind` ([error rules](https://github.com/google/styleguide/blob/cceb297e93677c31053e5e75de6b701a9204fc03/rustguide.md?plain=1#L694-L698)). A thousand lines later, use of `panic::catch_unwind` "is prohibited in first-party Rust code." ([panic rules](https://github.com/google/styleguide/blob/cceb297e93677c31053e5e75de6b701a9204fc03/rustguide.md?plain=1#L1748-L1769)) From "might be possible" to "prohibited" in one document. To be fair, there is an exception for using it as a last safety net, and Chrome, Android and Fuchsia require `panic=abort`.

Last one. "Don't omit patterns on non_exhaustive enums when matching" shows a `#[non_exhaustive]` enum Shape (Circle, Square, Triangle) and a good match ending in `Shape::Triangle | _ => {}` ([rule](https://github.com/google/styleguide/blob/cceb297e93677c31053e5e75de6b701a9204fc03/rustguide.md?plain=1#L1506-L1557)). I tried it. With the enum in another crate, the case the rule is written for, rustc and Clippy on 1.99.0 stayed quiet. With both snippets in one crate, as they sit on the page, rustc warned. The warning came from the `unreachable_patterns` lint:

```text
warning: unreachable pattern
  --> shapes/src/lib.rs:13:23
   |
13 |     Shape::Triangle | _ => {}
   |                       ^ no value can reach this
   |
   ...
   = note: `#[warn(unreachable_patterns)]` (part of `#[warn(unused)]`) on by default
```

`unreachable_patterns` is on by default, and it fires on `Shape::Triangle | _` because, per the Rust Reference, "Within the defining crate, `non_exhaustive` has no effect." ([Reference](https://github.com/rust-lang/reference/blob/bcd62f35e8bf480ec5b0fa569b6d12ea5924030c/src/attributes/type_system.md?plain=1#L22)) Not a bug in the guide. Just a small surprise if you paste its examples into one file.

## Pushes I'd leave at Google

Glob imports. The guide says don't, with few exceptions: `use super::*` in inline modules, third-party preludes at the reviewer's discretion. Then: "This also means that defining preludes should be avoided." ([rule](https://github.com/google/styleguide/blob/cceb297e93677c31053e5e75de6b701a9204fc03/rustguide.md?plain=1#L286-L321)) The standard library ships `std::io::prelude`, and the official guide formats glob imports without forbidding them. If you want the rule anyway, Clippy has a `wildcard_imports` lint, off by default. I turned it on: it flagged `use std::collections::*` and left `use std::io::prelude::*` alone. I keep the official position and my test-module globs.

Import granularity. Google's rule is one module per `use` statement, which it says corresponds to the rustfmt setting `imports_granularity = Module`, with a list of rustfmt options codebases may adopt ([list](https://github.com/google/styleguide/blob/cceb297e93677c31053e5e75de6b701a9204fc03/rustguide.md?plain=1#L450-L470)). I put the four options in a rustfmt.toml and ran `cargo +1.99.0 fmt`; here is the file and what it printed:

```text
$ cat rustfmt.toml
max_width = 100
hex_literal_case = "Lower"
format_macro_matchers = true
imports_granularity = "Module"

$ cargo +1.99.0 fmt
Warning: can't set `format_macro_matchers = true`, unstable features are only available in nightly channel.
Warning: can't set `imports_granularity = Module`, unstable features are only available in nightly channel.
```

Two options are nightly-only: `format_macro_matchers` and `imports_granularity`; stable rustfmt warns and carries on. rustfmt 1.10.0, shipped with 1.99.0, did apply `hex_literal_case`: `0xAB` became `0xab`, no warning, so `hex_literal_case` works on stable. And `max_width = 100` is already the default, matching the official 100 characters, yet it sits in a list of options a codebase may skip. Small smile.

Fairness: Google lets a codebase skip options its stable Rust does not have, so on stable the import rule becomes something reviewers check by hand. The guide also says "Don't use unstable features." That covers language features, not rustfmt options, so no contradiction. Still, enforcing `imports_granularity = Module` automatically needs nightly: on nightly-2026-02-24, rustfmt did split `use std::{collections::HashMap, fmt::Write};` into two `use` lines. The official position is "Tools must not merge or un-merge imports by default." ([imports](https://github.com/rust-lang/rust/blob/1.99.0/src/doc/style-guide/src/items.md?plain=1#L533-L547)) Closer to where I land.

Trait imports. The guide says "Import traits within function bodies", unless the trait's methods are used throughout the file. I keep `use std::io::Write;` at the top of my files and have not felt pain from it. Personal preference.

String joining. The guide prefers `format!` and `write!` over `+` for joining more than two strings, one reason being that they "require fewer allocations than concatenating strings using +" ([rule](https://github.com/google/styleguide/blob/cceb297e93677c31053e5e75de6b701a9204fc03/rustguide.md?plain=1#L1773-L1787)). I got curious and wrote a tiny global allocator that counts calls to alloc and realloc, release build, two sets of inputs. Four ways to join three strings; here is the output:

```text
$ cargo +1.99.0 run -q --release
a="hello" b=", " c="world"
a.to_string() + b + c              allocs=1 reallocs=2 len=12
owned + b + c (owned: String)      allocs=0 reallocs=2 len=12
format!("{a}{b}{c}")               allocs=1 reallocs=1 len=12
[a, b, c].concat()                 allocs=1 reallocs=0 len=12
a="/usr/local" b="/share/" c="doc/rust/html/index.html"
a.to_string() + b + c              allocs=1 reallocs=2 len=41
owned + b + c (owned: String)      allocs=0 reallocs=2 len=41
format!("{a}{b}{c}")               allocs=1 reallocs=2 len=41
[a, b, c].concat()                 allocs=1 reallocs=0 len=41
```

With short strings, `format!` did 1 alloc and 1 realloc, while `a.to_string() + b + c` did 1 alloc and 2 reallocs: `format!` wins. With longer, path-like strings, both did 1 alloc and 2 reallocs, a tie. When the first value is already an owned String, `+` reuses it: 0 allocs, 2 reallocs. And `concat()` did exactly 1 alloc and 0 reallocs in both cases, fewer calls than every other way. Honest limits: a realloc can grow in place, and I counted calls, not time. I did not benchmark speed. The guide's other reason, standard format strings instead of a home-made templating syntax, is about readability, and that one I agree with.

## For my own crates

In my own crates, not much changes. I keep rustfmt defaults, which is the official guide in practice, and I keep Clippy. From Google I borrow `expect` over `unwrap`, honest assert messages and named iterator chains. I also keep `use super::*` in my test modules, which Google allows too. As of 2026-11-12, the Scope section says Android, Chromium and the other codebases "intend to start applying it", and to "Expect more information here as these codebases adopt this guide." Let's see how it reads in a year, once Chromium has started living by it.
