#!/usr/bin/env node
/**
 * Generates a neon green favicon from public/logo.png (TV logo).
 * Neon green: rgb(57, 255, 20)
 * Writes public/favicon.png for use as the tab icon.
 */
import sharp from 'sharp';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const logoPath = join(root, 'public', 'logo.png');
const outPath = join(root, 'public', 'favicon.png');

if (!existsSync(logoPath)) {
  console.error('public/logo.png not found');
  process.exit(1);
}

const primaryGreen = { r: 57, g: 255, b: 20 };

const image = sharp(logoPath);
const meta = await image.metadata();
const { width = 256, height = 256 } = meta;

// Build green image: same dimensions, use logo as alpha mask.
// 1) Get raw RGBA of logo
const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h, channels } = info;
// 2) Replace RGB with green where alpha > 0, keep alpha
const out = Buffer.alloc(data.length);
for (let i = 0; i < data.length; i += channels) {
  const a = data[i + 3] ?? 255;
  out[i] = primaryGreen.r;
  out[i + 1] = primaryGreen.g;
  out[i + 2] = primaryGreen.b;
  out[i + 3] = a;
}
await sharp(out, { raw: { width: w, height: h, channels: 4 } })
  .png()
  .toFile(outPath);

console.log('Wrote public/favicon.png (neon green TV logo)');
