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

The fix had two parts:

**Step 1**: Add a `date` field to the About page. Since the root section uses `sort_by = "date"`, all pages need a date—even non-post pages.

**Step 2**: Hide the date from displaying on the About page using `show_date = false` in the front matter.

**Before:**
```toml
+++
title = "About"
description = "Learn about Oshadha G..."
template = "page.html"
weight = 1
[extra]
hide_from_list = true
comments = false
+++
```

**After:**
```toml
+++
title = "About"
description = "Learn about Oshadha G..."
template = "page.html"
date = 2025-01-01  # Required because root section uses sort_by = "date"
weight = 1
[extra]
hide_from_list = true
comments = false
show_date = false  # Hide the awkward date from displaying
+++
```

I also had to create a custom `templates/macros/post_macros.html` to override the theme's default meta macro and respect the `show_date` flag. But the front matter solution is the important part.

Now the About page builds correctly, appears in the correct order for pagination, but doesn't display the awkward "Published: 2025-01-01" meta.

### The Lesson

Root-level sections in Zola behave differently than you might think. If you set `sort_by = "date"` in a section, **all** pages in that section must have a date field—even non-post pages like About pages.

While Zola's docs mention this behavior, it's the kind of detail that's easy to gloss over when you're focused on building features. The solution is straightforward:
1. Give every page a date if your section sorts by date (I use `2025-01-01` for static pages)
2. Use a custom macro override to conditionally hide dates where they don't make sense

For static pages like About, seeing "Published: 2025-01-01" is awkward, so the `show_date = false` flag was essential.

### Quick Check

If you're having similar issues with Zola pages not building:

1. Check your section's `_index.md` for `sort_by` directives
2. Make sure all pages in that section have the required fields
3. Use `show_date = false` in front matter if you want to hide dates on static pages
4. Consider moving sorted content to a dedicated subsection

Sometimes the simplest fixes are the most unexpected. And sometimes you need two fixes instead of one.

