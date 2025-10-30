#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const ROOT = path.resolve(process.cwd());
const SRC = path.join(ROOT, 'themes', 'radion', 'static', 'icons', 'favicon', 'favicon.svg');
const OUT_DIR = path.join(ROOT, 'themes', 'radion', 'static', 'icons', 'favicon');

async function main() {
  const svg = await fs.readFile(SRC);
  const sizes = [96, 192, 512];
  for (const s of sizes) {
    const out = path.join(OUT_DIR, s === 512 ? 'web-app-manifest-512x512.png' : (s === 192 ? 'web-app-manifest-192x192.png' : 'favicon-96x96.png'));
    const buf = await sharp(svg).resize(s, s).png().toBuffer();
    await fs.writeFile(out, buf);
    console.log('Wrote', path.relative(ROOT, out));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });


