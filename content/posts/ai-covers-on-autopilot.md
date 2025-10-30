+++
title = "Covers on Autopilot — Why I Let AI Paint the Edges"
date = 2025-10-30
description = "A small, stubborn problem (blog covers) turned into a simple, reliable pipeline: prompt, generate, embed. Notes on the choices, the bumps, and the GitHub Actions that make it all work."
[taxonomies]
categories = ["Automation"]
tags = ["ai", "covers", "replicate", "github-actions", "zola"]
+++

There are jobs you can do by hand for years and never notice the drag. For me it was cover images. Each new post: open a design tool, stare at a blank canvas, export a PNG, wire it to the post. Not hard, just enough friction to make publishing feel heavier than it should.

This is a short note about shaving that yak with a tiny toolchain: a context‑aware prompt, an image model, and some guardrails in CI. No heroics—just removing a repeated decision so the writing flows.

## Why automate covers

- Consistency: 1200×630 every time. No more odd crops in link unfurls.
- Momentum: publishing shouldn’t wait for “design time”.
- Style: light background, a single accent, abstract shapes. Enough personality, zero fuss.

Over time the manual step was turning into a speed bump. That was the whole motivation.

## The bumps along the road (the important part)

I didn’t get it right on the first try. Here are the lessons that actually mattered.

1) Model and limits

At first I used Stable Horde for SDXL. It’s great and free, but CI doesn’t love queues. I kept seeing 400/429s in the logs (invalid payload or rate‑limited). Switched to Replicate with an API token; still got rate limits sometimes, but at least the errors were predictable.

2) Exact sizing

SDXL likes multiples of 64. I request 1024×576, then downscale to 1200×630 with Sharp. Crisp edges, correct aspect for social cards.

3) Slugs vs. filenames

My fallback logic assumed `page.slug` exactly matched the filename. It didn’t—some posts derive the slug from the permalink. I fixed the template to compute `slug-from-permalink` and look for `/images/covers/{slug}.png`. Simple, but that bug cost the most time.

4) “Why is it regenerating?”

CI starts from a clean checkout. If covers aren’t in Git, they disappear each run. I added a cache step that restores `static/images/covers` keyed to `content/posts/**/*.md`. Now the generator truly skips when a PNG already exists.

5) Context in prompts

Pure tags produced vague images. I added a little context: title + ~240 chars of summary (description if present, otherwise a clean slice of the body). Still abstract, just more grounded.

6) One‑time resets

Sometimes you do want a full refresh. There’s a manual “Run workflow” input (`force_regenerate=true`) that bypasses the “file exists” check once. Good for style changes or a model upgrade.

## How we decided on AI at all

I tried three options in order:

- Hand‑made banners (historically): high quality, low velocity.
- Programmatic shapes: reliable, but too repetitive.
- AI with guardrails: abstract, brand‑aware, hands‑off once it’s set.

The third option hit the balance. The prompt constrains style; the model supplies variation. It’s not “art direction”, but it serves the post—and that’s the only job here.

## The pipeline (nuts and bolts)

- Script: `scripts/generate-ai-covers.mjs`
  - Scans `content/posts/*.md`, pulls `tags`, `title`, and a short summary.
  - Prompt (simplified):
    > Abstract, minimal illustration. Tags: {tags}. Title: {title}. Context: {summary}. Vector‑like, clean geometric shapes, high contrast, brand accent #d64a48 on #f6f7f4. No text.
  - Calls Replicate SDXL (model version from a secret), requests 1024×576, saves 1200×630 as `static/images/covers/{slug}.png`.
  - Skips generation if the PNG already exists (unless `FORCE_REGENERATE_COVERS=1`).

- Template: `themes/radion/templates/page.html`
  - If a post doesn’t specify a cover, it tries `/images/covers/{slug-from-permalink}.png` and hides the figure if missing.

- CI: `.github/workflows/deploy.yml`
  - Restores a covers cache before generation; saves it after.
  - Optional manual input `force_regenerate` for a one‑time refresh.

## What GitHub Actions brings

The boring kind of power: reliability.

- Every run restores the previous covers, generates only what’s missing, and embeds without a front‑matter tweak.
- When rate‑limited, the post still publishes—missing images pick up on the next run.
- A small verification stage lists the covers in `public/images/covers` and checks that posts actually reference them.

## Closing the loop

This wasn’t about making the site “AI‑powered”. It was about removing a tiny friction point that kept breaking the flow. The rule of thumb I keep coming back to: automate anything that steals attention from writing. Covers were stealing attention. Now they aren’t.

And if the art ever needs a new feel? I flip the model or tweak the prompt, hit “Run workflow”, and let the pipeline repaint the edges while I get back to words.

