#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import sharp from 'sharp';

const ROOT = path.resolve(process.cwd());
const OUT_DIR = path.join(ROOT, 'static', 'images', 'covers');
const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN || '';
const REPLICATE_MODEL_VERSION = process.env.REPLICATE_MODEL_VERSION || '';
const BRAND_BG = '#f6f7f4';
const BRAND_ACCENT = '#d64a48';

function stripMd(s) {
  return s
    .replace(/`{3}[\s\S]*?`{3}/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/^#+\s+/gm, '')
    .replace(/[*_~>#\-]/g, '')
    .replace(/\s+/g, ' ') // collapse
    .trim();
}

async function discoverPosts() {
  const dir = path.join(ROOT, 'content', 'posts');
  const files = (await fs.readdir(dir)).filter(f => f.endsWith('.md') && f !== '_index.md');
  const posts = [];
  for (const f of files) {
    const slug = f.replace(/\.md$/, '');
    const src = await fs.readFile(path.join(dir, f), 'utf8');
    const fm = src.split('+++'); // TOML front matter delimited by +++ at top
    let tags = [];
    let title = slug.replace(/-/g, ' ');
    let desc = '';
    if (fm.length > 1) {
      const header = fm[1];
      // Try to read [taxonomies] tags = [ ... ] or tags = [ ... ]
      const m1 = header.match(/\[taxonomies\][\s\S]*?tags\s*=\s*\[(.*?)\]/);
      const m2 = header.match(/\ntags\s*=\s*\[(.*?)\]/);
      const raw = (m1 && m1[1]) || (m2 && m2[1]) || '';
      tags = raw
        .split(',')
        .map(s => s.replace(/['"\s]/g, ''))
        .filter(Boolean)
        .slice(0, 6);
      const t = header.match(/\ntitle\s*=\s*"([^"]+)"/);
      if (t) title = t[1];
      const d = header.match(/\ndescription\s*=\s*"([^"]+)"/);
      if (d) desc = d[1];
    }
    if (!desc && fm.length > 2) {
      const body = fm.slice(2).join('+++');
      desc = stripMd(body).slice(0, 240);
    }
    posts.push({ slug, tags, title, desc });
  }
  return posts;
}

function buildPrompt({ tags, title, desc }) {
  const tagText = tags.join(', ');
  const context = (desc || '').replace(/"/g, '').slice(0, 240);
  return `Abstract, minimal illustration for a tech blog cover. Topic tags: ${tagText}. Title: ${title}. Context: ${context}. Vector-like, clean geometric shapes, high contrast, brand accent ${BRAND_ACCENT} on subtle background ${BRAND_BG}, no text, no watermark, crisp edges, SDXL`;
}

async function ensureOut() { await fs.mkdir(OUT_DIR, { recursive: true }); }

async function imageExists(slug) {
  try { await fs.stat(path.join(OUT_DIR, `${slug}.png`)); return true; } catch { return false; }
}

// ---------------- Replicate -----------------
async function replicateRequest(prompt) {
  const body = {
    version: REPLICATE_MODEL_VERSION,
    input: {
      prompt,
      negative_prompt: 'text, watermark, signature, lowres, blurry, noisy',
      width: 1024,
      height: 576,
      guidance_scale: 6,
      num_inference_steps: 28
    }
  };
  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${REPLICATE_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`replicate request failed: ${res.status}`);
  const data = await res.json();
  return data.id;
}

async function replicateFetch(id, maxMs = 300000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { 'Authorization': `Token ${REPLICATE_TOKEN}` }
    });
    const data = await res.json();
    if (data.status === 'succeeded') {
      const url = Array.isArray(data.output) ? data.output[0] : data.output;
      const img = await fetch(url);
      return Buffer.from(await img.arrayBuffer());
    }
    if (data.status === 'failed' || data.status === 'canceled') throw new Error(`replicate ${data.status}`);
    await new Promise(r => setTimeout(r, 4000));
  }
  throw new Error('replicate timeout');
}

async function saveCover(slug, buf) {
  // Downscale to exactly 1200x630, cover fit with background
  const out = await sharp(buf)
    .resize(1200, 630, { fit: 'cover', position: 'centre' })
    .png({ quality: 90 })
    .toBuffer();
  await fs.writeFile(path.join(OUT_DIR, `${slug}.png`), out);
}

async function generateFor({ slug, tags, title, desc }) {
  // Do NOT regenerate if already present
  const force = process.env.FORCE_REGENERATE_COVERS === '1' || process.env.FORCE_REGENERATE_COVERS === 'true';
  if (!force && (await imageExists(slug))) return false;
  const prompt = buildPrompt({ tags, title, desc });
  try {
    if (!(REPLICATE_TOKEN && REPLICATE_MODEL_VERSION)) {
      console.log('Replicate not configured; skipping');
      return false;
    }
    const id = await replicateRequest(prompt);
    const img = await replicateFetch(id);
    await saveCover(slug, img);
    console.log('AI cover saved:', slug);
    return true;
  } catch (e) {
    console.warn('AI generation failed for', slug, e.message);
    return false;
  }
}

async function main() {
  await ensureOut();
  const POSTS = await discoverPosts();
  let count = 0;
  for (const post of POSTS) {
    if (count >= 6) break; // budget safety
    const changed = await generateFor(post);
    if (changed) count++;
  }
}

main().catch(err => { console.error(err); process.exit(1); });


