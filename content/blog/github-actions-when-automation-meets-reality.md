+++
title = "GitHub Actions: When Automation Meets Reality"
date = 2025-10-29
description = "Lessons learned from wrestling with GitHub Actions: submodules, deployment strategies, and when to embrace manual control."
[taxonomies]
categories = ["DevOps"]
tags = ["github-actions", "ci-cd", "automation", "deployment", "lessons-learned"]
+++

When you first set up GitHub Actions for a project, it feels like magic. Push your code, and the CI/CD pipeline takes care of everything—building, testing, deploying. But sometimes, the magic breaks. And when it does, you learn things you never expected to learn.

I recently went through a journey with GitHub Actions that taught me a lot about the gap between "this should work" and "this actually works." Here's what I learned, without exposing too many project details.

---

## Background: Building with Zola

For context, this blog is built using [Zola](https://www.getzola.org/), a static site generator written in Rust. Zola takes Markdown files and templates, processes them, and outputs a static HTML site. It's fast, simple, and doesn't require a runtime—just compile your site and serve the static files.

The deployment process is straightforward:
1. Write content in Markdown
2. Run `zola build` to generate static HTML
3. Deploy the generated files to a hosting service

This makes Zola an ideal candidate for GitHub Pages: you build once, deploy the static files, and GitHub Pages serves them. The challenge comes when you want to automate this process with GitHub Actions.

## The Promise of Automation

GitHub Actions promises a lot:
- Automatic builds on every push
- Consistent deployment environments
- Less manual work, fewer human errors
- Integration with GitHub Pages for static sites

The setup looks straightforward:
1. Create a `.github/workflows/deploy.yml` file
2. Define your build steps
3. Push and watch it work

But reality has a way of complicating things.

---

## Issue #1: The Submodule Problem

One of the first issues I encountered was related to git submodules. If your project includes external dependencies managed as submodules, GitHub Actions needs explicit configuration to handle them.

**The Error:**
```
Error: fatal: No url found for submodule path 'themes/radion' in .gitmodules
Error: The process '/usr/bin/git' failed with exit code 128
```

**The Root Cause:**
GitHub Actions tries to fetch submodules by default, but if your `.gitmodules` file is missing or incomplete, or if the submodule path exists but isn't properly configured, the build fails.

**The Solution:**
If you're not actually using submodules (maybe you copied files directly), you have two options:

1. **Remove the submodule completely:**
   ```bash
   git rm --cached themes/radion
   rm -rf themes/radion/.git
   git add themes/radion
   git commit -m "Convert submodule to regular directory"
   ```

2. **Configure GitHub Actions to skip submodules:**
   ```yaml
   - uses: actions/checkout@v4
     with:
       submodules: false
   ```

I went with option 1 because I wasn't actually using submodules—I had copied the theme files directly into the repository. The submodule reference was leftover from an earlier setup.

---

## Issue #2: Branch Confusion

GitHub Pages supports two deployment methods:
- **GitHub Actions:** Build your site using a workflow
- **Branch-based:** Serve files directly from a branch (like `gh-pages`)

I started with GitHub Actions, but ran into issues. The build kept failing, and debugging CI/CD pipelines can be frustrating—you push, wait, check logs, repeat.

**The Revelation:**
Sometimes, manual deployment to a `gh-pages` branch is simpler and more reliable. You get:
- Full control over when and how you deploy
- Ability to test locally before deploying
- No hidden automation surprises
- Easier debugging (you can inspect the built files directly)

**The Manual Approach:**
```bash
# Build locally
zola build --output-dir public --force

# Deploy to gh-pages branch
git checkout -B gh-pages
rsync -av --delete --exclude='.git/' public/ .
git add -A
git commit -m "Publish: $(date +%Y-%m-%d)"
git push -f origin gh-pages
git checkout main
```

Is this less "modern"? Maybe. But it's transparent, predictable, and gives you control when you need it.

---

## Update: Automation Wins After All

After writing the initial version of this post, I realized something: maintaining two branches manually was becoming a burden. The workflow was reliable, but it required:
- Remembering to switch branches
- Running build commands
- Manually syncing files
- Switching back to main

**The Solution:**
I revisited GitHub Actions, but this time with a clear understanding of the issues:
1. Configured submodules properly (`submodules: false` since we don't use them)
2. Used a reliable deployment action (`peaceiris/actions-gh-pages`)
3. Set up the workflow to trigger on push to `main`

**The Result:**
Now I just push to `main`, and GitHub Actions handles everything:
- Builds the site automatically
- Deploys to `gh-pages` branch
- Updates GitHub Pages

**What Changed:**
The key was understanding the submodule issue first. Once that was resolved, the automation became reliable. The workflow is simple and transparent—I can see exactly what's happening in the Actions tab.

**The Lesson:**
Sometimes automation *does* make sense. The difference between my first attempt and my second attempt was:
- Understanding the root causes (submodules, branch setup)
- Using proven, maintained actions
- Starting simple and adding complexity only when needed

The manual approach taught me what was happening under the hood. That knowledge made the automation reliable.

---

## Issue #3: Missing Scripts and Assets

When deploying to GitHub Pages, you need to ensure all your assets are included. This might seem obvious, but it's easy to miss.

**The Problem:**
Your site builds locally, but when deployed, certain features don't work—like a theme toggle button that does nothing, or search functionality that's broken.

**The Cause:**
JavaScript files weren't being included in the HTML. The build process generated the files, but the HTML templates weren't referencing them correctly, or the script tags were missing entirely.

**The Fix:**
Manually verify that all necessary scripts are loaded:
- Check your HTML templates
- Ensure script tags are in the correct order
- Verify paths are correct (especially for GitHub Pages subdirectory paths)

Sometimes, the simplest solution is to open the generated HTML and check what's actually there.

---

## Issue #4: The Abstraction Trap

Here's the thing about automation: when it works, it's great. When it doesn't, you're debugging an abstraction layer you may not fully understand.

**The Pattern:**
1. Something breaks
2. You check GitHub Actions logs
3. You see an error message
4. You make a change
5. You push and wait
6. Repeat

This cycle can be slow, especially if your builds take a few minutes each time.

**The Alternative:**
With manual deployment:
1. Build locally (instant feedback)
2. Test locally
3. Deploy when ready
4. Inspect the deployed files directly

The feedback loop is faster, and you understand every step.

---

## When to Use GitHub Actions

Don't get me wrong—GitHub Actions is powerful and useful. Use it when:

- You need automated testing on every commit
- You want consistent build environments
- Multiple people are deploying
- You need to run expensive operations (like building large projects)
- You want to enforce code quality checks

**But consider manual deployment when:**
- Your build process is simple
- You want full control
- You're deploying infrequently
- You want to understand every step
- Debugging automation is slowing you down

## Issue #5: GitHub Pages Source Branch Mismatch

Even after getting the deployment pipeline working, some issues only surfaced when viewing the site in production. These weren't build failures—they were configuration problems.

### The GitHub Pages Source Branch Mismatch

**The Symptom:**
After deploying fixes, the blog post updates weren't appearing on the live site. The build succeeded, GitHub Actions showed successful deployment, but visiting the site showed old content.

**The Root Cause:**
GitHub Pages has two deployment methods:
1. **GitHub Actions** - Pages builds from Actions workflow output
2. **Branch-based** - Pages serves files directly from a branch (like `gh-pages`)

The problem was a configuration mismatch: GitHub Pages was set to use "GitHub Actions" as the source, but our workflow was deploying to the `gh-pages` branch. GitHub Pages was trying to serve from the Actions output, not the branch we were deploying to.

**The Fix:**
Changed GitHub Pages source back to `gh-pages` branch in repository settings:
1. Go to repository Settings → Pages
2. Under "Source", select "Deploy from a branch"
3. Choose `gh-pages` branch and `/ (root)` folder
4. Save

**Why This Happened:**
When you first set up GitHub Actions, GitHub Pages might automatically switch to "GitHub Actions" mode. If your workflow deploys to `gh-pages` branch (which is common), you need to ensure the Pages source matches where you're deploying.

**The Lesson:**
Always verify that your GitHub Pages source matches your deployment target. If your Actions workflow deploys to `gh-pages`, make sure Pages is configured to serve from that branch. Configuration mismatches can cause silent failures where everything appears to work but content doesn't update.

### Testing Across Browsers

**The Problem:**
Different browsers cache differently. Chrome might show updated content while Firefox shows old content, or vice versa. However, in this case, the issue wasn't browser caching—it was a configuration mismatch.

**The Solution:**
1. Always verify GitHub Pages source matches your deployment method
2. Check GitHub Actions logs to confirm deployment succeeded
3. Wait 2-5 minutes for GitHub Pages to rebuild after deployment
4. Use hard refresh (Cmd+Shift+R / Ctrl+Shift+R) when testing
5. Test in multiple browsers to rule out caching issues

**What I Learned:**
- GitHub Pages configuration must match your deployment method
- Always verify the deployment target matches the Pages source
- Testing locally doesn't catch configuration mismatches

---

## Lessons Learned

1. **Understand your dependencies:** Know whether you're using submodules, npm packages, or other external resources. This affects your CI/CD setup.

2. **Test locally first:** Always build and test your site locally before relying on automation. Automation catches mistakes, but you should catch them first.

3. **Keep it simple:** If automation adds complexity without clear benefits, consider if manual processes might be better for your use case.

4. **Inspect the output:** When something doesn't work, look at the actual generated files. HTML errors, missing assets, and broken links are often visible in the source.

5. **Verify GitHub Pages configuration matches deployment:** If your Actions workflow deploys to `gh-pages` branch, ensure GitHub Pages source is set to that branch. Configuration mismatches cause silent failures.

6. **Test across browsers:** Different browsers cache differently. Always test in multiple browsers after deployment, and use hard refresh when debugging.

7. **Document your process:** Whether you use automation or manual deployment, document it. Future you (and your team) will thank you.

---

## Conclusion

GitHub Actions is a powerful tool, but it's not always the right tool—at least not immediately. My journey started with frustration, moved to manual control, and ended with successful automation.

The manual approach wasn't wasted effort. It taught me:
- What was happening under the hood
- How the build process worked
- What could go wrong and why

That knowledge made the automation reliable. When I returned to GitHub Actions, I understood the root causes and could configure it correctly.

The key is to choose the approach that fits your project, your team, and your workflow. Sometimes that means starting manually to understand the process, then automating once you know what you're automating.

At the end of the day, the goal is to deploy reliably and efficiently. Whether that's through GitHub Actions, manual commands, or a hybrid approach, what matters is that it works for you—and that you understand why it works.

---

### Further Reading
- [GitHub Actions Documentation](https://docs.github.com/en/actions) – Official documentation
- [GitHub Pages Deployment](https://docs.github.com/en/pages) – Deployment strategies
- [Managing Git Submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules) – Git submodule basics
