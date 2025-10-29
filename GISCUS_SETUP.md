# Giscus Comments Setup Guide

## Overview
Giscus uses GitHub Discussions to power comments on your blog. Each blog post will have its own discussion thread.

## Prerequisites
- Your repository must be public (✅ `RockyRx/personal-blog` is public)
- GitHub Discussions must be enabled on your repository

## Step 1: Enable GitHub Discussions

1. Go to your repository: https://github.com/RockyRx/personal-blog
2. Click **Settings** tab
3. Scroll down to **Features** section
4. Check **Discussions** checkbox
5. Click **Set up discussions**

## Step 2: Get Giscus Configuration

1. Go to [Giscus.app](https://giscus.app/)
2. Fill in the configuration:

   **Repository**: `RockyRx/personal-blog`
   
   **Repository ID**: (will be auto-filled after selecting repo)
   
   **Category**: `General` (or create a new one)
   
   **Category ID**: (will be auto-filled after selecting category)
   
   **Mapping**: `pathname`
   
   **Discussion Term**: `pathname`
   
   **Theme**: `preferred_color_scheme` (will match your site's light/dark mode)
   
   **Language**: `en`

3. Copy the generated script configuration

## Step 3: Update config.toml

Replace the empty values in `config.toml`:

```toml
# Giscus configuration
giscus_repo = "RockyRx/personal-blog"
giscus_repo_id = "R_kgDOKxxxxxxxx"  # From Giscus setup
giscus_data_category = "General"
giscus_data_category_id = "DIC_kwDOKxxxxxxxx"  # From Giscus setup
```

## Step 4: Deploy

1. Save the changes
2. Commit and push to `main`
3. GitHub Actions will deploy automatically

## Step 5: Test

1. Visit any blog post on your site
2. Scroll to the bottom
3. You should see the Giscus comments widget
4. Try posting a comment (requires GitHub login)

## Features

- **Threaded discussions**: Comments can be replied to
- **Reactions**: Users can react with emojis
- **Moderation**: You can moderate comments through GitHub
- **Theme matching**: Comments automatically match your site's light/dark theme
- **Per-post discussions**: Each blog post gets its own discussion thread

## Troubleshooting

**Comments not showing?**
- Check that GitHub Discussions is enabled
- Verify the repository ID and category ID are correct
- Check browser console for errors

**Theme not matching?**
- The script uses `preferred_color_scheme` to match your site's theme
- This should automatically switch between light and dark based on your site's theme toggle

**Want to disable comments on specific posts?**
Add to the post's front matter:
```toml
+++
title = "My Post"
# ... other front matter ...
[extra]
comments = false
+++
```

## Security

- Comments are stored in GitHub Discussions
- Users need GitHub accounts to comment
- You have full control over moderation through GitHub
- No external database or service required
