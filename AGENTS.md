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
  - `public/categories/` and `public/tags/` exist and are styled.
  - Random post renders and links work.

## Rollback
- If deployment breaks, you can:
  - Revert the commit on `main`: `git revert <commit_sha>` and push
  - Or fix the issue and push a new commit - GitHub Actions will redeploy automatically
  - Check GitHub Actions logs if deployment fails: Go to Actions tab → Failed workflow → View logs
