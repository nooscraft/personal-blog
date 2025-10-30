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

function buildSVG({ title, logoB64 }) {
  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
      <foreignObject x="0" y="140" width="1056" height="400">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font: 700 68px 'JetBrains Mono', monospace; color:#111827; line-height:1.2;">
          ${safeTitle}
        </div>
      </foreignObject>
    </g>
    <rect x="0" y="0" width="100%" height="100%" fill="none" stroke="${ACCENT}" stroke-width="8"/>
  </svg>`;
}

async function main() {
  await ensureOut();
  const logoB64 = await getLogoBase64();

  for (const { slug, title } of POSTS) {
    const svg = buildSVG({ title, logoB64 });
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


