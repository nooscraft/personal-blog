+++
title = "Stable Diffusion never gave me off-white"
date = 2026-10-07
description = "My old SDXL cover prompt asked for an off-white background every time. The covers I could recover say otherwise. Why this blog's covers now come from illo instead."
draft = false
[taxonomies]
tags = ["ai", "covers", "stable-diffusion", "illo", "zola"]
categories = ["Automation"]
+++

My Stable Diffusion prompt asked for an off-white `#f6f7f4` background on every cover, and none of the three old covers I recovered has one. From October 2025 to July 2026, covers were SDXL through Replicate, built from each post's title and tags. [My earlier post](@/posts/ai-covers-on-autopilot.md) covers the pipeline.

```text
Abstract, minimal illustration for a tech blog cover. [...] Vector-like, clean geometric shapes, high contrast, brand accent #d64a48 on subtle background #f6f7f4, no text, no watermark, crisp edges, SDXL
```

The old covers were gitignored, cached only by GitHub Actions, so they were gone when I replaced them. I found a few on the Wayback Machine. The three I downloaded have orange or mint green backgrounds. None is off-white. Below is the same post, my uv internals one: first the old Stable Diffusion cover, then the current illo cover.

<img src="/images/sdxl-cover-uv-how-it-works-under-the-hood.png" alt="Old Stable Diffusion cover for the uv post: abstract pipes and machinery on an orange background" class="inline" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid var(--color-border-default, #e5e7eb);" />

<img src="/images/covers/uv-how-it-works-under-the-hood.png" alt="Current illo cover for the uv post: the Blip robot next to a delivery truck full of gears, on off-white paper" class="inline" style="max-width: 100%; height: auto; border-radius: 8px; border: 1px solid var(--color-border-default, #e5e7eb);" />

To be fair, I asked for abstract shapes, so that part is my fault. The background colour is what SDXL kept ignoring. In July 2026 I switched to [illo](https://www.illo-skill.com/), which makes editorial illustrations where a recurring mascot performs the idea of the post. Here that's Blip, a small robot with a screen for a face. My new prompt: Blip performs the idea with one or two simple props, large and centered, never a side decoration. All covers have the same robot now. I like that it looks like one blog.

Let's see how it goes.
