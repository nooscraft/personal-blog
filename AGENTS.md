# Operational guide for agents working on this blog

## Goals
- Keep the site always deployable on GitHub Pages.
- Never break homepage listings or taxonomy pages.
- **CRITICAL**: Just push to `main` - GitHub Actions handles everything automatically!

## Repository Structure
- **Single repository**: `/Users/oshadhagunawardena/Projects/personal/personal-blog`
- **Single branch to work with**: `main` (GitHub Actions automatically deploys to `gh-pages`)

## Development Workflow
1. **Always work on `main` branch**:
   - `cd /Users/oshadhagunawardena/Projects/personal/personal-blog`
   - `git checkout main`
   - Make changes to content, templates, config, etc.
   - Test locally: `zola serve` (available at http://127.0.0.1:1111)

2. **Commit and push to `main`**:
   - `git add .`
   - `git commit -m "Your commit message"`
   - `git push origin main`
   - **That's it!** GitHub Actions will automatically build and deploy to GitHub Pages.

## Automated Deployment
- **GitHub Actions** automatically builds and deploys on every push to `main`
- No manual deployment steps needed
- The workflow builds the site and pushes to `gh-pages` branch automatically
- Check the Actions tab in GitHub to see deployment status

## Content rules
- All posts go under `content/posts/` as Markdown files with TOML front matter.
- Post URLs will be `/posts/{slug}/` (not `/blog/`).
- Required front matter keys: `title`, `date`, optional: `tags`, `categories`, `draft=false`.
- To hide non-post utility pages (like Tags/Categories) from homepage lists, set:
  - `extra.hide_from_list = true` in their front matter.

## Taxonomies
- Configured in `config.toml`:
  - `taxonomies = [{name = "categories", feed = true}, {name = "tags", feed = true}]`
- Styled list pages are driven by:
  - Template: `templates/taxonomy_list.html`
  - Pages: `content/tags.md` and `content/categories.md`
- Do NOT place raw HTML into `public/` manually; always rebuild with Zola.

## Templates
- Homepage template: `templates/index.html`
  - Filters out pages with `extra.hide_from_list == true` and paginates blog posts.
- Section template: `themes/radion/templates/section.html` (overrides are allowed under `templates/` if needed).

## Do not do
- Do not edit files directly on `gh-pages` branch - it's automatically managed by GitHub Actions.
- Do not delete `.git` in the repository.
- Do not add standalone HTML pages under `public/` by hand (it's in `.gitignore` anyway).
- Do not keep `themes/radion` as a git submodule; ensure it's regular files (no nested `.git`).

## Quick checks after changes
- Run `zola build` and confirm it prints `Creating N pages and M sections` without errors.
- Verify locally:
  - Homepage lists recent posts; does not list Tags/Categories.
  - `public/posts/` directory exists with all posts.
  - `public/categories/` and `public/tags/` exist and are styled.
  - Random post renders and links work.
  - Post URLs use `/posts/` path (not `/blog/`).

## Rollback
- If deployment breaks, you can:
  - Revert the commit on `main`: `git revert <commit_sha>` and push
  - Or fix the issue and push a new commit - GitHub Actions will redeploy automatically
  - Check GitHub Actions logs if deployment fails: Go to Actions tab → Failed workflow → View logs

## AI cover images (Replicate)

Overview
- Covers are generated automatically for posts missing a PNG at `static/images/covers/{slug}.png`.
- Provider: Replicate (SDXL). Stable Horde and icon-based fallback were removed.
- Output: 1200×630 PNG (SEO/social-friendly aspect ratio).

Where
- Generator: `scripts/generate-ai-covers.mjs`
- CI step: job “Generate AI covers (Replicate)” in `.github/workflows/deploy.yml`
- Embedding: `themes/radion/templates/page.html` automatically tries:
  1) `page.extra.cover_image_url`
  2) `page.extra.cover_image_static`
  3) page asset reference
  4) fallback to `/images/covers/{slug-from-permalink}.png`

Secrets / config
- `REPLICATE_API_TOKEN` – API token from replicate.com
- `REPLICATE_MODEL_VERSION` – SDXL version hash
- Optional manual trigger: `force_regenerate` input on the workflow (true/false)
  - When true: sets `FORCE_REGENERATE_COVERS=1` to ignore the exists check once

Prompting (context-aware)
- The script scans `content/posts/*.md` and extracts:
  - tags (from `[taxonomies] tags = [..]` or top-level `tags`)
  - `title` and optional `description`; if description missing, uses a short summary from body
- Prompt template (simplified):
  - “Abstract, minimal illustration for a tech blog cover. Topic tags: {tags}. Title: {title}. Context: {summary}. Vector-like, clean geometric shapes, high contrast, brand accent #d64a48 on subtle background #f6f7f4, no text, no watermark, crisp edges, SDXL.”
- Negative prompt: `text, watermark, signature, lowres, blurry, noisy`
- Request size: 1024×576, then downscale to exactly 1200×630.

Skip logic and caching
- The generator skips a post if `static/images/covers/{slug}.png` already exists unless `FORCE_REGENERATE_COVERS=1`.
- CI restores a cache of `static/images/covers` keyed to `content/posts/**/*.md` so existing covers persist across runs.

Manual full refresh (one time)
1) Actions → Build and Deploy → Run workflow
2) Set `force_regenerate` to `true` and run
3) The job ignores existing PNGs and regenerates all

Troubleshooting
- “AI cover saved: …” repeats every run → cache miss
  - Confirm cache steps restore/save; ensure key uses only `content/posts/**/*.md`
- PNG exists but not embedded → slug mismatch
  - Template derives slug from `page.permalink`; filename must be `{slug-from-permalink}.png`
- Replicate 402/429 errors
  - 402: credits exhausted; 429: rate limits. Script retries with backoff; missing posts will fill on the next run.

Verification
- CI prints available covers in `public/images/covers` and checks each post HTML for `/images/covers/{slug}.png`.

## Theme Features (Radion)

The blog uses the [Radion theme](https://github.com/aaranxu/radion) with customizations. Key features:

### External Link Icons
- **Part of theme aesthetic**: External link icons (orange square with arrow) appear on all links containing `://`
- This includes: navigation links (Home, Categories, Tags), pagination links (Next/Previous), and blog post titles
- Only removed from: feed icons (RSS) and figure/image links
- CSS rule: `a[href*="://"]::after` adds the icon automatically

### Post Descriptions on Homepage
- Posts on the homepage show a short description/summary below the title
- Priority order:
  1. `page.summary` (if defined in front matter)
  2. `page.description` (fallback if summary not available)
- Each listing includes a "Read More »" link
- Template: `themes/radion/templates/macros/post_macros.html` → `page_in_list` macro

### Dark/Light Mode Toggle
- Theme mode is set to `"toggle"` in `config.toml` (`extra.theme_mode`)
- Toggle button appears in the header next to search and RSS icons
- Users can switch between light and dark themes
- Preference is stored in localStorage
- Default theme is light mode (set in `themes/radion/static/js/init-theme.js`)

### Navigation Spacing
- Desktop: Navigation links have `gap: 12px` between them
- Mobile: Navigation wraps and centers with appropriate spacing
- CSS: `themes/radion/sass/_theme.scss` → `.nav-links` styling
