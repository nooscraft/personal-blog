+++
title = "Hieratic Prompt Compression: From Prototype to Production"
date = 2026-02-20
description = "Tokuin v0.2.0 is here with the feature I promised: rule-based, structure-aware prompt compression. Here's how it works and why you might actually use it."
[taxonomies]
categories = ["Engineering"]
tags = ["llm", "prompt-engineering", "compression", "tokuin", "rust"]
+++

Back in November, I wrote about [an ambitious prototype](@/posts/hieratic-prompt-compression-prototype.md): a way to shrink LLM prompts by 50–80% without losing meaning, using a structured format I called "Hieratic".

Today, that prototype is real. **Tokuin v0.2.0** is out, and it includes a full implementation of Hieratic prompt compression.

You can grab it now:
```bash
curl -fsSL https://raw.githubusercontent.com/nooscraft/tokuin/main/install.sh | bash
```

Or check the [release notes](https://github.com/nooscraft/tokuin/discussions/5).

---

## The Problem (Recap)

We all know the pain: context windows are finite, tokens cost money, and latency kills user experience. You stuff a prompt with examples, role definitions, and constraints, and suddenly you're paying for 2,000 tokens of boilerplate on every single request.

The industry's answer has mostly been "use a bigger model" or "summarize with another LLM." But adding an LLM step to compress your prompt introduces latency, cost, and non-determinism.

I wanted something different: **deterministic, rule-based, structure-aware compression.** A tool that acts like a scribe, rewriting your verbose prose into a compact shorthand that models can still read natively.

---

## Meet Hieratic

The core idea is simple: LLMs don't need polite, grammatically correct English. They need semantic signals.

Hieratic strips away the fluff and organizes the signal into a structured format.

**Before (850 tokens):**
> You are an expert programmer with 10 years of experience in building distributed systems, microservices, and cloud-native applications... [200 more tokens of role context]
> Example 1: Authentication Bug Fix... [detailed narrative example]

**After (285 tokens - 66% less):**
```
@HIERATIC v1.0
@ROLE[inline] "Expert engineer: 10y distributed systems, microservices, cloud-native"
@EXAMPLES[inline]
1. Auth bug: session bypass → HMAC signing → 94% bot reduction
2. DB perf: 2.3s queries → pooling+cache → 0.1s, 10x capacity
@TASK Analyze code and provide recommendations
@FOCUS: performance, security, maintainability
@STYLE: concise, actionable
```

You pipe this compressed text directly to the LLM. No decoding step needed. The model just *gets it*.

---

## What's in v0.2.0?

This isn't just a regex script. The v0.2.0 release includes a complete compression engine built in Rust:

### 1. Compression Levels
- **Light (30-50%)**: Safe for almost anything. Removes obvious fluff.
- **Medium (50-70%)**: The default. Rewrites verbose sections into Hieratic shorthand.
- **Aggressive (70-90%)**: For when you really need space. Verify with quality metrics first.

### 2. Quality Metrics
How do you know if the compression broke your prompt? Tokuin can score it:

```bash
tokuin compress prompt.txt --quality
```

It checks:
- **Semantic Similarity**: Do the embeddings match?
- **Critical Instructions**: Are the key verbs and constraints still there?
- **Structural Integrity**: Did we break your JSON schema?

### 3. LLM-as-a-Judge
For the ultimate test, you can run an automated evaluation where a judge model (like Claude 3 Opus) compares the outputs of your original vs. compressed prompt.

```bash
tokuin compress prompt.txt --quality --llm-judge
```

### 4. Incremental Compression
For chat apps, you don't want to re-compress the whole history every turn. Tokuin supports incremental compression, processing only the new tokens and keeping a rolling state.

---

## Does it actually work?

Yes, but with caveats.

It works **exceptionally well** for:
- Long system prompts with repetitive role definitions
- Prompts with many few-shot examples
- Technical specs with clear sections

It **doesn't help much** for:
- Very short prompts (< 50 tokens)
- Already dense text (code, mathematical formulas)
- Prompts where exact wording is legally critical

In my testing, I'm seeing **60-70% reduction** on typical RAG prompts with minimal loss in output quality.

---

## Try it out

The best way to see if it works for you is to try it on your own prompts.

```bash
# Install
curl -fsSL https://raw.githubusercontent.com/nooscraft/tokuin/main/install.sh | bash

# Compress
tokuin compress your-prompt.txt --quality

# See the result
cat your-prompt.txt.hieratic
```

If you do try it, I'd love to hear your compression ratios. Drop a note in the [GitHub Discussion](https://github.com/nooscraft/tokuin/discussions/5).

This started as a "what if" blog post. Now it's a tool you can run. That's the best kind of engineering.
