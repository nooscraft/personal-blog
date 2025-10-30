#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import sharp from 'sharp';

const ROOT = path.resolve(process.cwd());
const OUT_DIR = path.join(ROOT, 'static', 'images', 'covers');
const API = 'https://stablehorde.net/api/v2';
const API_KEY = process.env.HORDE_API_KEY || '';
const BRAND_BG = '#f6f7f4';
const BRAND_ACCENT = '#d64a48';

const POSTS = [
  { slug: 'rust-serde-datetime-deserialization-error', tags: ['rust','serde','datetime'] },
  { slug: 'cursor-payments-confusion', tags: ['cursor','pricing','payments'] },
  { slug: 'how-embracing-rust-sharpens-the-mind', tags: ['rust','mindset'] },
  { slug: 'github-actions-when-automation-meets-reality', tags: ['github','actions','ci'] },
  { slug: 'why-rust-makes-you-better-engineer', tags: ['rust','engineering'] },
  { slug: 'how-my-terminal-looks', tags: ['terminal','zsh','tmux'] },
];

function buildPrompt(tags) {
  const tagText = tags.join(', ');
  return `Abstract, minimal illustration related to ${tagText}; modern tech blog cover; vector style; clean geometric shapes; high contrast; brand accent ${BRAND_ACCENT} on subtle background ${BRAND_BG}; no text; no watermark; crisp edges; SDXL`;
}

async function ensureOut() { await fs.mkdir(OUT_DIR, { recursive: true }); }

async function imageExists(slug) {
  try { await fs.stat(path.join(OUT_DIR, `${slug}.png`)); return true; } catch { return false; }
}

async function requestGeneration(prompt) {
  const body = {
    prompt,
    params: {
      sampler_name: 'k_euler',
      cfg_scale: 6.5,
      denoising_strength: 0.7,
      seed_variation: 1,
      width: 1216,
      height: 704,
      steps: 28,
      n: 1,
    },
    nsfw: false,
    censor_nsfw: true,
    r2: true,
    workers: 1,
    models: ['SDXL 1.0'],
  };
  const res = await fetch(`${API}/generate/async`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': API_KEY || '0000000000' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`horde request failed: ${res.status}`);
  const data = await res.json();
  return data.id;
}

async function waitFor(id, maxMs = 240000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const res = await fetch(`${API}/generate/check/${id}`);
    const data = await res.json();
    if (data.done) return true;
    await new Promise(r => setTimeout(r, 4000));
  }
  return false;
}

async function fetchResult(id) {
  const res = await fetch(`${API}/generate/status/${id}`);
  const data = await res.json();
  const gen = data?.generations?.[0];
  if (!gen || !gen.img) throw new Error('no image in generation');
  const b64 = gen.img.startsWith('data:image') ? gen.img.split(',')[1] : gen.img;
  return Buffer.from(b64, 'base64');
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
  if (!API_KEY) { console.log('HORDE_API_KEY missing; skipping AI generation'); return false; }
  const exists = await imageExists(slug);
  if (exists) return false;
  const prompt = buildPrompt(tags);
  try {
    const id = await requestGeneration(prompt);
    const ok = await waitFor(id);
    if (!ok) throw new Error('timeout');
    const img = await fetchResult(id);
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
  let count = 0;
  for (const { slug, tags } of POSTS) {
    if (count >= 6) break; // budget safety
    const changed = await generateFor(slug, tags);
    if (changed) count++;
  }
}

main().catch(err => { console.error(err); process.exit(1); });


