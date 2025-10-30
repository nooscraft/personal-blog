#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const ROOT = path.resolve(process.cwd());
const OUT_DIR = path.join(ROOT, 'static', 'images', 'covers');
const WIDTH = 1200;
const HEIGHT = 630;
const BG = '#f6f7f4';
const ACCENT = '#d64a48';
const SITE = 'noos.blog';
const LOGO_DIR = path.join(ROOT, 'static', 'images', 'cover-logos');

const POSTS = [
  { slug: 'rust-serde-datetime-deserialization-error', title: 'When Rust Expects a String But Gets a Map' },
  { slug: 'cursor-payments-confusion', title: 'The Confusing World of Cursor Payments' },
  { slug: 'how-embracing-rust-sharpens-the-mind', title: 'How Embracing Rust Sharpens the Mind — and Elevates Teams' },
  { slug: 'github-actions-when-automation-meets-reality', title: 'GitHub Actions: When Automation Meets Reality' },
  { slug: 'why-rust-makes-you-better-engineer', title: 'Why Rust Makes You a Better Engineer' },
  { slug: 'how-my-terminal-looks', title: 'How my terminal looks' },
];

async function ensureOut() {
  await fs.mkdir(OUT_DIR, { recursive: true });
}

async function getLogoBase64() {
  const logoPath = path.join(ROOT, 'themes', 'radion', 'static', 'icons', 'favicon', 'favicon.svg');
  try {
    const svg = await fs.readFile(logoPath, 'utf8');
    return Buffer.from(svg).toString('base64');
  } catch (_) {
    const fallback = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='12' fill='${ACCENT}'/></svg>`;
    return Buffer.from(fallback).toString('base64');
  }
}

async function getIconB64(name) {
  const p = path.join(LOGO_DIR, `${name}.svg`);
  const svg = await fs.readFile(p, 'utf8');
  return Buffer.from(svg).toString('base64');
}

async function iconsFor(slug) {
  const map = {
    'rust-serde-datetime-deserialization-error': ['rust','json'],
    'cursor-payments-confusion': ['terminal','github'],
    'how-embracing-rust-sharpens-the-mind': ['rust'],
    'github-actions-when-automation-meets-reality': ['github','terminal'],
    'why-rust-makes-you-better-engineer': ['rust'],
    'how-my-terminal-looks': ['terminal','zsh','tmux'],
  };
  return (map[slug] || ['terminal']).slice(0,4);
}

function wrapTitle(title, maxCharsPerLine = 26) {
  const words = title.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxCharsPerLine && line.length > 0) {
      lines.push(line.trim());
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) lines.push(line.trim());
  return lines;
}

function buildSVG({ title, logoB64, iconsB64 }) {
  const lines = wrapTitle(title, 26).map(l => l
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;'));
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <style type="text/css"><![CDATA[
        .title { font: 700 68px 'JetBrains Mono', monospace; fill: #111827; }
        .subtitle { font: 400 36px 'JetBrains Mono', monospace; fill: ${ACCENT}; }
      ]]></style>
    </defs>
    <rect width="100%" height="100%" fill="${BG}"/>
    <g transform="translate(72, 120)">
      <image href="data:image/svg+xml;base64,${logoB64}" x="0" y="0" width="96" height="96"/>
      <text x="120" y="64" class="subtitle">${SITE}</text>
      <text x="0" y="180" class="title">
        ${lines.map((line, i) => `<tspan x="0" dy="${i === 0 ? 0 : 76}">${line}</tspan>`).join('')}
      </text>
    </g>
    <!-- Icons grid -->
    <g transform="translate(820, 80)">
      ${iconsB64.map((b64, idx) => {
        const col = idx % 2; const row = Math.floor(idx/2);
        const x = col * 180; const y = row * 180;
        return `<image href="data:image/svg+xml;base64,${b64}" x="${x}" y="${y}" width="160" height="160"/>`;
      }).join('')}
    </g>
    <rect x="0" y="0" width="100%" height="100%" fill="none" stroke="${ACCENT}" stroke-width="8"/>
  </svg>`;
}

async function main() {
  await ensureOut();
  const logoB64 = await getLogoBase64();

  for (const { slug, title } of POSTS) {
    const names = await iconsFor(slug);
    const iconsB64 = [];
    for (const n of names) {
      try { iconsB64.push(await getIconB64(n)); } catch (_) {}
    }
    const svg = buildSVG({ title, logoB64, iconsB64 });
    const png = await sharp(Buffer.from(svg)).png({ quality: 90 }).toBuffer();
    const outPath = path.join(OUT_DIR, `${slug}.png`);
    await fs.writeFile(outPath, png);
    console.log('Wrote', path.relative(ROOT, outPath));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


