# Noos Blog

[![Build and Deploy](https://github.com/nooscraft/personal-blog/actions/workflows/deploy.yml/badge.svg)](https://github.com/nooscraft/personal-blog/actions/workflows/deploy.yml)

> **Where Thought, Code, and Craft Converge**

Personal blog about programming, technology, and engineering insights. Topics include Rust, DevOps, Linux, and software craftsmanship.

**Live Site:** [noos.blog](https://noos.blog)

---

## Features

- 🎨 **Modern Design**: Clean and responsive design using the [Radion](https://github.com/aaranxu/radion) theme
- ⚡ **Fast Performance**: Static site generation with [Zola](https://www.getzola.org/)
- 🌓 **Dark/Light Mode**: Toggle between light and dark themes
- 🔍 **Search Functionality**: Built-in search for easy content discovery
- 💬 **Comments**: Giscus integration for post discussions
- 🎨 **AI-Generated Covers**: Automatic cover images via [illo](https://www.illo-skill.com/) (Blip mascot)
- 📱 **Mobile Responsive**: Optimized for all device sizes
- 🔗 **RSS Feed**: Atom feed for subscribers
- 📊 **Analytics**: Google Analytics (GA4) integration

---

## Technology Stack

- **Static Site Generator**: [Zola](https://www.getzola.org/) (written in Rust)
- **Theme**: [Radion](https://github.com/aaranxu/radion)
- **Deployment**: GitHub Pages with GitHub Actions
- **Content**: Markdown with TOML front matter
- **Comments**: [Giscus](https://giscus.app/)
- **Cover Generation**: [illo](https://www.illo-skill.com/) + OpenRouter (Blip)

---

## Local Development

### Prerequisites

- [Zola](https://www.getzola.org/documentation/getting-started/installation/) (v0.19.2 or later)

### Setup

```bash
# Clone the repository
git clone git@github.com:nooscraft/personal-blog.git
cd personal-blog

# Start the development server
zola serve

# The site will be available at http://127.0.0.1:1111
```

### Building for Production

```bash
# Build the static site
zola build

# Output will be in the `public/` directory
```

---

## Project Structure

```
personal-blog/
├── content/           # Blog posts and pages
│   ├── posts/        # Blog posts (Markdown)
│   ├── about.md      # About page
│   └── _index.md     # Homepage content
├── templates/         # Custom templates
├── themes/            # Radion theme
├── static/            # Static assets (images, CSS, JS)
├── scripts/           # Build scripts (cover generation, etc.)
├── config.toml        # Site configuration
└── .github/           # GitHub Actions workflows
    └── workflows/
        └── deploy.yml # Build and deployment workflow
```

---

## Writing Posts

All posts are written in Markdown with TOML front matter. Create a new file in `content/posts/`:

```toml
+++
title = "Your Post Title"
date = 2025-01-28
description = "A brief description for SEO and listings"
[taxonomies]
categories = ["Category"]
tags = ["tag1", "tag2"]
[extra]
cover_image_static = "images/covers/your-slug.png"
+++

Your post content in Markdown...
```

### Required Fields

- `title` - Post title
- `date` - Publication date (YYYY-MM-DD)
- `description` - Brief description (used for SEO and listings)

### Optional Fields

- `taxonomies.categories` - Post categories
- `taxonomies.tags` - Post tags
- `extra.cover_image_static` - Cover image path
- `draft = false` - Set to `true` to hide from listings

---

## Deployment

The site is automatically deployed to GitHub Pages using GitHub Actions whenever changes are pushed to the `main` branch.

### How It Works

1. Push to `main` branch
2. GitHub Actions triggers the build workflow
3. Zola builds the static site
4. Missing covers are generated with illo/Blip (if `OPENROUTER_API_KEY` is set)
5. Built site is pushed to `gh-pages` branch
6. GitHub Pages serves the site

**No manual deployment steps needed!** Just push to `main` and GitHub Actions handles everything.

### Manual Workflow Trigger

You can manually trigger the workflow with optional parameters:

- `force_regenerate`: Force illo to regenerate all covers (ignores existing PNGs)

---

## Configuration

Key configuration is in `config.toml`:

- **Site Info**: `base_url`, `title`, `description`
- **Theme**: `theme = "radion"`
- **Taxonomies**: Categories and tags
- **Comments**: Giscus configuration
- **Analytics**: Google Analytics ID

See `config.toml` for all available options.

---

## Features Details

### AI Cover Generation (illo / Blip)

Cover images are automatically generated for posts missing a PNG at `static/images/covers/{slug}.png`. Uses [illo](https://www.illo-skill.com/) with the **Blip** character (risograph style) via OpenRouter.

**Scripts**: `scripts/generate-illo-covers.py`, `scripts/illo-bootstrap.sh`  
**Engine**: vendored `scripts/vendor/illo.py`  
**CI Step**: “Generate covers (illo / Blip)” during GitHub Actions build  
**Config**: Requires `OPENROUTER_API_KEY` secret in GitHub  

Locally:

```bash
bash scripts/illo-bootstrap.sh
# OpenRouter: export OPENROUTER_API_KEY=...
# or use a logged-in Grok CLI
python3 scripts/generate-illo-covers.py
```

### Giscus Comments

Comments powered by Giscus (GitHub Discussions). Configured in `config.toml`:

```toml
[extra]
comments = true
giscus_repo = "nooscraft/personal-blog"
giscus_repo_id = "R_kgDOQJ_XNg"
# ... more config
```

### RSS Feed

Atom feed automatically generated at `/atom.xml`. Includes all posts with full content.

---

## Contributing

This is a personal blog, but if you find a bug or have a suggestion, feel free to open an issue!

---

## License

This project is open source and available under the [MIT License](LICENSE).

---

## Author

**Oshadha G**

- Blog: [noos.blog](https://noos.blog)
- GitHub: [@nooscraft](https://github.com/nooscraft)

---

## Acknowledgments

- [Zola](https://www.getzola.org/) - Static site generator
- [Radion Theme](https://github.com/aaranxu/radion) - Blog theme
- [Giscus](https://giscus.app/) - Comments system
- [illo](https://www.illo-skill.com/) / [OpenRouter](https://openrouter.ai/) - Cover generation (Blip)
