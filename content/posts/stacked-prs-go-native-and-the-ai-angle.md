+++
title = "Stacked PRs go native in GitHub, and what that means for AI-assisted work"
date = 2026-04-19
description = "GitHub is bringing stacked pull requests in natively. A look at what changes, what does not, and why the workflow matters more now that AI agents are writing a lot of the diffs."
draft = false
[taxonomies]
tags = ["github", "stacked-prs", "code-review", "ai", "developer-workflow", "gh-stack"]
categories = ["Engineering"]
+++

GitHub announced [native Stacked PRs](https://github.github.com/gh-stack), still in private preview. I wanted to write about it for two reasons. First, it bakes in a workflow some of us have been doing for a while, either manually or via third-party tools, mostly to keep PRs small enough that reviewers actually read them. Second, it lands at a moment when AI agents are producing more of the diffs, and the gap between "diff size" and "what a human can review well" is getting wider every month.

## What a stack is, quickly

A stack is a chain of pull requests in the same repo where each PR targets the branch of the PR below it. Instead of one giant PR that touches the database layer, the API, and the UI, you get three smaller ones that build on each other:

```
main
 ↑
 PR #1: auth-layer
 ↑
 PR #2: api-endpoints
 ↑
 PR #3: frontend
```

Each layer is reviewed on its own. When the bottom is ready you can merge the bottom couple, or all of them at once, and the rest auto-rebase onto the new base. That auto-rebase is one of the things that makes a stack worth the trouble; doing it by hand across five branches is the part that always made me give up before.

## What is actually new

Stacking as a workflow is not new. [Graphite](https://graphite.dev/stacking) has built a polished CLI (`gt`), a VS Code extension, a PR inbox, and an AI review product around it. Meta's [`ghstack`](https://github.com/ezyang/ghstack) by Edward Yang has been around for years and powers a lot of the PyTorch workflow. There is also [`spr`](https://github.com/ejoffe/spr), and historically Phabricator did this before Meta sunset it.

What GitHub adds, going by the [overview docs](https://github.github.com/gh-stack/?ref=console.dev), is the bits that previous tools could only approximate from the outside:

- A stack map in the PR header so reviewers can navigate between layers.
- Branch protection rules enforced against the **final target branch** (usually `main`), not just the immediate parent branch of each PR.
- CI runs each PR as if it were targeting the final branch, so green checks actually mean something.
- One-click merge of multiple layers, with automatic rebase of the rest of the stack afterwards.

The "branch protection against the final target" point is the one that quietly matters. With third-party tools, your PR #3 in a stack technically targets PR #2's branch, which often does not have the same protection rules as `main`. Teams used to work around this with naming conventions, bots, or just hoping reviewers paid attention. Native handling closes that gap.

## Trying the CLI right now

The feature is in private preview as of April 2026, and you need to be allowlisted on a repo for the server-side bits (`submit`, `merge`, the stack map UI) to work. But the CLI itself is publicly installable. I poked at it a bit:

```bash
$ gh extension install github/gh-stack
$ gh stack --help
Create, navigate, and manage stacks of branches and pull requests.

Usage:
  gh stack [command]

Available Commands:
  add         Add a new branch on top of the current stack
  alias       Create a shell alias for gh stack
  bottom      Check out the bottom branch of the stack
  checkout    Checkout a stack from a PR number or branch name
  down        Check out a branch further down in the stack
  feedback    Submit feedback for gh-stack
  init        Initialize a new stack
  merge       Merge a stack of PRs
  push        Push all branches in the current stack to the remote
  rebase      Rebase a stack of branches
  submit      Create a stack of PRs on GitHub
  sync        Sync the current stack with the remote
  top         Check out the top branch of the stack
  unstack     Delete a stack locally and on GitHub
```

The local workflow works without any preview access. In a throwaway repo:

```bash
$ git init -q && git commit --allow-empty -m "init" -q
$ gh stack init test-stack-bottom
✓ Creating stack with trunk main and branch test-stack-bottom
Switched to branch test-stack-bottom
To add a new layer to your stack, run `gh stack add`
When you're ready to push to GitHub and open a stack of PRs, run `gh stack submit`

$ echo "auth" > auth.txt && git add . && git commit -m "auth layer" -q
$ gh stack add api-layer
✓ Created and checked out branch "api-layer"

$ git log --oneline --all --decorate
463808f (HEAD -> api-layer, test-stack-bottom) auth layer
2b6a4ea (main) init
```

So you can install it, play with `init`, `add`, `bottom`, `top`, `down`, `up`, `rebase`, `unstack` locally today. The bits that need GitHub-side support are the actual `submit` and `merge`, and that part is gated by the [waitlist](https://github.github.com/gh-stack/?ref=console.dev). Prerequisites are `gh` v2.0+ and Git 2.20+ ([Quick Start](https://github.github.com/gh-stack/getting-started/quick-start/)), both pretty undemanding.

There is also a `gh stack alias` command that wires up `gs` as a shorter alias, which I will probably end up using because typing `gh stack add` thirty times a day gets old.

## The AI-assisted angle

Here is the part I actually wanted to think out loud about.

If you have reviewed a PR opened by an AI agent (Cursor, Codex, Claude Code, Copilot, or any of the cloud agents), you know the failure mode. The agent gets asked to "add user profiles", and twenty minutes later there is a PR with a migration, a schema, a service layer, three endpoints, two React components, a settings page, and seventeen unit tests. All in one or two commits. Reviewing that with any rigour is an afternoon's work, and the path of least resistance is to skim, push back on a couple of obvious things, and merge.

Stacked PRs are a structural answer to that problem. If the agent (or the human supervising it) is encouraged to land the migration first, then the service, then the endpoints, then the UI, each layer is something a person can actually read in one sitting. Conflicts get smaller. Reverts get surgical. The cost of "actually let's redo the data model" drops from "throw away the whole PR" to "throw away the bottom layer and rebase".

GitHub seems to know this is the angle. The docs include an AI agent integration step:

```bash
npx skills add github/gh-stack
```

That installs a skill telling the agent how to author and manage stacks. I have not tried it yet (no preview access), so I cannot tell you how good it is in practice. The bet is interesting though: instead of teaching humans to slice their AI-generated work after the fact, teach the agent to slice its own work and produce a stack from the start.

A few honest reservations:

- AI agents can mechanically split a diff (one file per commit, one logical component per commit). They are still not great at deciding *where* the right review boundaries are. That is exactly the kind of architectural judgment they tend to miss. A stack of five PRs split in the wrong places is arguably worse than one large PR, because reviewers context-switch between layers without the layering actually helping them.
- A stack is only as solid as its bottom layer. If the data model in PR #1 is wrong, every later PR is built on sand. AI-authored stacks raise that risk because the agent often does not pause long enough to question the foundation.
- Merge queues, codeowners, and stacks together are still a frontier. I expect most of the next round of papercuts will be in that intersection.
- This is GitHub's native version, but there are mature alternatives. If your team already pays for Graphite, the stack-management half of what they sell is now duplicated in GitHub itself, but the review queue, dashboards, and Diamond AI review are not. Whether you switch is more of a procurement question than a tooling question.

## What I am going to actually try

Some small experiments I have lined up once I get preview access:

- Use `gh stack init` for any change that touches more than one logical layer (data, service, UI). One layer per PR.
- For AI-generated work, ask the agent to produce a plan first, treat each plan step as a layer, and only let it write code one layer at a time.
- Test the merge-multiple-layers-at-once flow on a low-stakes change before relying on it for anything serious.
- See whether the GitHub skill (`npx skills add github/gh-stack`) actually gets the agent to author stacks unprompted, or whether it still needs hand-holding.

If any of these turn out interesting, I will come back with an update.

For now the [overview](https://github.github.com/gh-stack) and the [Quick Start](https://github.github.com/gh-stack/getting-started/quick-start/) are the two pages worth reading. The waitlist is on the same page.

Let's see how it goes once it is open.
