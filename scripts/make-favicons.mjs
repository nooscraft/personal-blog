#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const ROOT = path.resolve(process.cwd());
const SRC = path.join(ROOT, 'themes', 'radion', 'static', 'icons', 'favicon', 'favicon.svg');
const OUT = path.join(ROOT, 'themes', 'radion', 'static', 'icons', 'favicon');

async function generate() {
  const svg = await fs.readFile(SRC);
  // 96x96 PNG
  const png96 = await sharp(svg).resize(96, 96).png().toBuffer();
  await fs.writeFile(path.join(OUT, 'favicon-96x96.png'), png96);
  // 180x180 Apple Touch PNG
  const apple = await sharp(svg).resize(180, 180).png().toBuffer();
  await fs.writeFile(path.join(OUT, 'apple-touch-icon.png'), apple);
  // ICO from multiple sizes
  const sizes = [16, 32, 48];
  const pngs = await Promise.all(sizes.map(s => sharp(svg).resize(s, s).png().toBuffer()));
  const ico = await pngToIco(pngs);
  await fs.writeFile(path.join(OUT, 'favicon.ico'), ico);
  console.log('Favicons updated:', sizes.join(','), 'and 96/180 PNGs');
}

generate().catch((e) => { console.error(e); process.exit(1); });


