+++
title = "Java vs Rust: A ROUGE-L Performance Comparison"
date = 2025-11-02
description = "Comparing ROUGE-L implementations in Java and Rust: same algorithm, same results, dramatically different performance. What I learned from this fun experiment."
[taxonomies]
categories = ["Programming"]
tags = ["rust", "java", "performance", "nlp", "rouge-l", "benchmarking"]
[extra]
cover_image_static = "images/covers/java-vs-rust-rouge-l-performance.png"
+++

### The Experiment

I was curious about the performance differences between Java and Rust for a specific workload. So I built identical ROUGE-L implementations in both languages and ran some benchmarks. The code was AI-generated, the algorithm was the same, and the results were mathematically equivalent. But the performance? That's where it gets interesting.

### What is ROUGE-L?

ROUGE-L (Recall-Oriented Understudy for Gisting Evaluation - Longest Common Subsequence) is a metric used to evaluate text summarization quality. It's part of the [ROUGE evaluation suite](https://aclanthology.org/W04-1013/) developed by Chin-Yew Lin in 2004, which has become a standard in natural language processing for assessing how well generated summaries match reference summaries.

**How it works:**

ROUGE-L measures similarity based on the Longest Common Subsequence (LCS) between sequences of words. It calculates three metrics:

- **Precision**: LCS / (number of words in candidate summary)
- **Recall**: LCS / (number of words in reference summary)
- **F-Measure**: 2 × (Precision × Recall) / (Precision + Recall)

The algorithm uses dynamic programming with O(m × n) time complexity, where m and n are the lengths of the two sequences. It's a straightforward implementation, which makes it a good candidate for comparing language performance.

ROUGE-L is particularly useful because it doesn't require exact word matches—it finds the longest sequence of words that appear in the same order in both texts, making it more flexible than n-gram overlap methods like ROUGE-1 or ROUGE-2.

### The Setup

Both implementations:
- Use the same dynamic programming algorithm for LCS calculation
- Tokenize text the same way (lowercase, whitespace-based splitting)
- Handle the same 16 test examples across 6 complexity levels
- Produce identical mathematical results

The only difference is the language they're written in.

**Test scenarios include:**
- Basic text comparisons
- Structured data (JSON, HTML)
- Mixed content with embedded structures
- Real-world technical documentation

You can find the full comparison project on [GitHub](https://github.com/nooscraft/rouge-l-comparison).

### The Results

**Accuracy:** Both implementations produced **100% identical results** across all 16 test cases. Every F-Measure, Precision, and Recall value matched perfectly. This confirms the algorithms are mathematically equivalent.

**Performance:** That's where things get interesting.

After multiple benchmark runs with 10 iterations each:

**Java:**
- Average: 52-62ms per run
- Median: 51-61ms
- Standard deviation: 1.5-13ms (relatively consistent)
- Includes JVM startup time in every run
- Performance stabilizes quickly after first iteration

**Rust:**
- Average: 21-40ms (heavily skewed by first cold start)
- Median: 2.5-4ms (after warmup)
- First iteration: 190-360ms (cold start overhead including compilation)
- Warm average: 2.4-4.4ms (excluding first run)
- Standard deviation: 60-115ms (largely due to cold start variability)

**The speedup:** After warmup, Rust was consistently **12-25x faster** than Java for this workload. For example, in one run: Java median 56.66ms vs Rust warm average 2.50ms = **24.76x speedup**. The median Rust time (2.5-3ms) versus Java's median (52-56ms) tells the story.

### What This Means

**For Java:**
- JVM startup adds significant overhead (~50-60ms)
- Once running, performance is consistent
- The runtime environment is predictable but has a fixed cost

**For Rust:**
- Cold start includes compilation/optimization overhead (~200-350ms)
- Once warmed up, execution is extremely fast (~2.5-3ms)
- Compiled binary runs without runtime interpretation overhead

**The reality:** In production, both would run with warmup periods. Java would maintain its ~55ms average. Rust would settle into its ~2.5-3ms sweet spot. The performance difference would still be substantial.

### Observations

**Tradeoffs:**

1. **Startup time:** Java has consistent startup overhead. Rust has a larger initial cold start but negligible warm overhead.

2. **Consistency:** Java's performance is more predictable from run to run. Rust's cold start variability makes early measurements misleading.

3. **Warm performance:** Once both are warmed up, Rust's compiled nature provides significant advantages for CPU-bound work.

4. **Ecosystem:** Java has mature NLP libraries. Rust has growing ecosystem support. For this isolated algorithm, both worked well.

**The "just for fun" part:**

This was an experiment. I wanted to see what would happen if you took the same algorithm, implemented it identically in two languages, and compared performance. The answer: same results, dramatically different performance characteristics.

### Why This Matters

For production systems evaluating summarization quality:
- **Throughput matters:** Processing thousands of summaries per second benefits from Rust's speed
- **Latency matters:** If this runs in a request path, 2.5ms vs 55ms is significant
- **Infrastructure matters:** Java's JVM ecosystem vs Rust's compiled binary have different deployment considerations

Neither is "better" in absolute terms. They have different tradeoffs. Understanding those tradeoffs is what matters.

### References

- [Lin, C.-Y. (2004). ROUGE: A Package for Automatic Evaluation of Summaries](https://aclanthology.org/W04-1013/) - The original paper introducing ROUGE metrics
- [ROUGE Metrics Documentation](https://en.wikipedia.org/wiki/ROUGE_(metric)) - Wikipedia overview of ROUGE evaluation metrics  
- [Comparison Project on GitHub](https://github.com/nooscraft/rouge-l-comparison) - Full source code and benchmarks

---

The code is [available on GitHub](https://github.com/nooscraft/rouge-l-comparison) if you want to run your own benchmarks. Same algorithm, same results, different performance characteristics. Sometimes the fun experiments teach you the most.

