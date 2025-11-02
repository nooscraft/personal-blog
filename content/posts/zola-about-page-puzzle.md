+++
title = "The Zola About Page Puzzle: When Root Sections Bite Back"
date = 2025-11-02
description = "A quick dive into how Zola handles root-level pages differently than you might expect, and the simple fix that resolved everything."
[taxonomies]
categories = ["DevOps"]
tags = ["zola", "static-site-generator", "troubleshooting", "lessons-learned"]
[extra]
cover_image_static = "images/covers/zola-about-page-puzzle.png"
+++

### The Goal

I wanted to add an About page to my blog. Simple enough, right? Create `content/about.md`, add it to the navigation menu, and done.

Wrong.

### The Problem

I created the About page, updated the navigation, and ran `zola build`. Instead of a clean build, I got this:

```
Warning: 1 page(s) ignored (missing date or weight in a sorted section):
Warning: - /Users/oshadhagunawardena/Projects/personal/personal-blog/content/about.md
```

The page wasn't being built at all. But wait—why does an About page need a date? It's not a blog post.

### The Investigation

The issue was in my `content/_index.md` file:

```toml
+++
title = "Home"
paginate_by = 5
sort_by = "date"
transparent = true
template = "index.html"
+++
```

See that `sort_by = "date"`? That was the culprit. According to [Zola's documentation](https://www.getzola.org/documentation/content/section/), when you set `sort_by = "date"` in a section's front matter, **all pages in that section** must have a date field. Pages without the required field are ignored during rendering and a warning is displayed.

This is documented behavior, but it's easy to miss when you're just trying to add a simple About page.

### The Solution

The fix was simple: remove `sort_by = "date"` from the root section. The homepage doesn't actually need it—the posts section has its own `_index.md` that handles post sorting.

**Before:**
```toml
+++
title = "Home"
paginate_by = 5
sort_by = "date"  # This breaks non-post pages
transparent = true
template = "index.html"
+++
```

**After:**
```toml
+++
title = "Home"
paginate_by = 5
transparent = true
template = "index.html"
+++
```

Now the About page builds correctly, and the homepage still paginates posts just fine.

### The Lesson

Root-level sections in Zola behave differently than you might think. If you mix blog posts and regular pages in the same section, be careful with `sort_by`—it applies to **all** pages in that section, not just the posts.

While Zola's docs mention this behavior, it's the kind of detail that's easy to gloss over when you're focused on building features. For my setup, the solution was to let the `posts/` section handle its own sorting, and keep the root section simple.

### Quick Check

If you're having similar issues with Zola pages not building:

1. Check your section's `_index.md` for `sort_by` directives
2. Make sure all pages in that section have the required fields
3. Consider moving sorted content to a dedicated subsection

Sometimes the simplest fixes are the most unexpected.

