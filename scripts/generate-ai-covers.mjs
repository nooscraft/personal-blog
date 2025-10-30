#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import sharp from 'sharp';

const ROOT = path.resolve(process.cwd());
const OUT_DIR = path.join(ROOT, 'static', 'images', 'covers');
const HORDE_API = 'https://stablehorde.net/api/v2';
const HORDE_API_KEY = process.env.HORDE_API_KEY || '';
const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN || '';
const REPLICATE_MODEL_VERSION = process.env.REPLICATE_MODEL_VERSION || '';
const BRAND_BG = '#f6f7f4';
const BRAND_ACCENT = '#d64a48';

async function discoverPosts() {
  const dir = path.join(ROOT, 'content', 'posts');
  const files = (await fs.readdir(dir)).filter(f => f.endsWith('.md') && f !== '_index.md');
  const posts = [];
  for (const f of files) {
    const slug = f.replace(/\.md$/, '');
    const src = await fs.readFile(path.join(dir, f), 'utf8');
    const fm = src.split('+++'); // TOML front matter delimited by +++ at top
    let tags = [];
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
    }
    posts.push({ slug, tags });
  }
  return posts;
}

function buildPrompt(tags) {
  const tagText = tags.join(', ');
  return `Abstract, minimal illustration related to ${tagText}; modern tech blog cover; vector style; clean geometric shapes; high contrast; brand accent ${BRAND_ACCENT} on subtle background ${BRAND_BG}; no text; no watermark; crisp edges; SDXL`;
}

async function ensureOut() { await fs.mkdir(OUT_DIR, { recursive: true }); }

async function imageExists(slug) {
  try { await fs.stat(path.join(OUT_DIR, `${slug}.png`)); return true; } catch { return false; }
}

// ---------------- Stable Horde -----------------
async function hordeRequest(prompt) {
  const body = {
    prompt,
    params: {
      sampler_name: 'k_euler',
      cfg_scale: 6.5,
      denoising_strength: 0.7,
      seed_variation: 1,
      width: 1024,
      height: 576,
      steps: 28,
      n: 1,
    },
    nsfw: false,
    censor_nsfw: true,
    r2: true,
    workers: 1,
    models: ['SDXL 1.0'],
  };
  const res = await fetch(`${HORDE_API}/generate/async`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': HORDE_API_KEY || '0000000000',
      'Client-Agent': 'noos.blog:1.0 (github.com/RockyRx/personal-blog)'
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`horde request failed: ${res.status}`);
  const data = await res.json();
  return data.id;
}

async function hordeWait(id, maxMs = 240000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const res = await fetch(`${HORDE_API}/generate/check/${id}`);
    const data = await res.json();
    if (data.done) return true;
    await new Promise(r => setTimeout(r, 4000));
  }
  return false;
}

async function hordeFetchResult(id) {
  const res = await fetch(`${HORDE_API}/generate/status/${id}`);
  const data = await res.json();
  const gen = data?.generations?.[0];
  if (!gen || !gen.img) throw new Error('no image in generation');
  const b64 = gen.img.startsWith('data:image') ? gen.img.split(',')[1] : gen.img;
  return Buffer.from(b64, 'base64');
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

async function generateFor(slug, tags) {
  const exists = await imageExists(slug);
  if (exists) return false;
  const prompt = buildPrompt(tags);
  try {
    let img;
    if (REPLICATE_TOKEN && REPLICATE_MODEL_VERSION) {
      const id = await replicateRequest(prompt);
      img = await replicateFetch(id);
    } else if (HORDE_API_KEY) {
      const id = await hordeRequest(prompt);
      const ok = await hordeWait(id);
      if (!ok) throw new Error('timeout');
      img = await hordeFetchResult(id);
    } else {
      console.log('No AI provider configured; skipping');
      return false;
    }
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
  for (const { slug, tags } of POSTS) {
    if (count >= 6) break; // budget safety
    const changed = await generateFor(slug, tags);
    if (changed) count++;
  }
}

main().catch(err => { console.error(err); process.exit(1); });


