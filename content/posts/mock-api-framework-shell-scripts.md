+++
title = "mock: Build APIs with Shell Scripts, Not Frameworks"
date = 2025-01-28
description = "mock is a lightweight API framework that lets you build endpoints using shell scripts—perfect for prototyping, testing, and quick integrations."
[taxonomies]
categories = ["Tools"]
tags = ["api", "shell", "devops", "prototyping", "testing"]
+++

Sometimes you need an API endpoint fast. Not a full framework, not a production service, just something that responds to HTTP requests. [mock](https://dhuan.github.io/mock/) is exactly that—a lightweight tool that turns shell scripts into HTTP endpoints.

## The Concept

Instead of spinning up Express, Flask, or any other framework, mock lets you define endpoints with simple shell scripts:

```bash
$ mock serve \
  --route "/users" \
  --method "GET" \
  --shell-script 'get_users.sh'
```

Your shell script becomes the response handler. Inside it, you use mock's utilities to build HTTP responses: `mock write` to send data, `mock set-header` to add headers, and access to the full shell environment.

## Why This Matters

This approach shines for:
- **Prototyping**: Mock external APIs you're integrating with
- **Testing**: Create test fixtures without setting up databases
- **Quick integrations**: Bridge gaps between services using familiar shell tools
- **DevOps scripts**: Expose your automation scripts as HTTP endpoints

You get all the power of shell (`grep`, `awk`, `curl`, databases, file systems) wrapped in HTTP. No dependencies beyond what's already on your system.

## The Details

Mock supports JSON config files or command-line parameters. You can set response headers, status codes, route parameters, conditional responses, and even serve static files. It's comprehensive enough for complex scenarios while staying dead simple.

If you've ever thought "I wish I could just write a bash script and expose it as an API," mock is that tool.

**Documentation**: [dhuan.github.io/mock](https://dhuan.github.io/mock/latest/getting_started.html)
