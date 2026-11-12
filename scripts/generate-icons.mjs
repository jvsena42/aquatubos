/*
 * Generates the favicon, PWA icons and social image from the brand SVGs.
 *
 *   npm run icons
 *
 * Sources (src/assets/brand):
 *   favicon.svg            copied to public/favicon.svg (small mark, switches colours in dark mode)
 *   logo-mark-small.svg    public/favicon.ico (one 32 px PNG inside an ICO container)
 *   logo-mark-inverse.svg  the app icons, placed on a solid brand-blue background
 *   og-image.svg           public/og-image.png (1200x630, all text already converted to paths)
 *
 * Outputs (public):
 *   favicon.svg, favicon.ico
 *   icons/icon-192.png, icons/icon-512.png   rounded square, transparent corners (purpose "any")
 *   icons/icon-maskable-512.png              full-bleed square, mark inside the 80% safe zone
 *   icons/apple-touch-icon.png               180 px, opaque square (iOS rounds the corners)
 *   og-image.png
 *
 * The output is deterministic: no fonts, dates or random values are involved, so running the
 * script twice with the same sharp version gives byte-identical files. PNGs are written with an
 * indexed palette to keep them small. Commit the regenerated files together with the SVG change.
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const brand = (name) => `${root}src/assets/brand/${name}`;
const pub = (name) => `${root}public/${name}`;

/** Background of the app icons. Matches --color-primary (light theme). */
const BRAND_BLUE = '#0b4f8a';
/** Fraction of the canvas covered by the 64x64 mark artboard. */
const MARK_SCALE = 0.76;
/**
 * The mark's drawing covers 47x56 of its 64x64 artboard, so at 0.62 its diagonal spans 71% of
 * the canvas and stays inside the 80% maskable safe circle.
 */
const MASKABLE_MARK_SCALE = 0.62;
/** Corner radius of the "any" icons as a fraction of the size. */
const CORNER_RADIUS = 0.22;

const PNG_OPTIONS = { palette: true, compressionLevel: 9, effort: 10 };

/** Rasterises an SVG file to a square PNG buffer of `size` pixels with a transparent background. */
async function renderSvg(file, size) {
  const svg = await readFile(file);
  // Raster at the target size (the artboards are 64 units wide; 72 dpi means 1 unit = 1 px).
  return sharp(svg, { density: (72 * size) / 64 })
    .resize(size, size)
    .png()
    .toBuffer();
}

/** Mark centred on a brand-blue square. `radius` > 0 rounds the corners (transparent outside). */
async function appIcon(size, markScale, radius = 0) {
  const markSize = Math.round(size * markScale);
  const offset = Math.round((size - markSize) / 2);
  const background = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect width="${size}" height="${size}" rx="${size * radius}" fill="${BRAND_BLUE}"/></svg>`,
  );
  const mark = await renderSvg(brand('logo-mark-inverse.svg'), markSize);
  const icon = sharp(background).composite([{ input: mark, left: offset, top: offset }]);
  return (radius > 0 ? icon : icon.flatten({ background: BRAND_BLUE })).png(PNG_OPTIONS).toBuffer();
}

/** Wraps one PNG in an ICO container (ICONDIR + one ICONDIRENTRY + the PNG bytes). */
function icoFromPng(png, size) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  header.writeUInt8(size, 6); // width
  header.writeUInt8(size, 7); // height
  header.writeUInt8(0, 8); // palette size (none)
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(png.length, 14); // image size
  header.writeUInt32LE(header.length, 18); // image offset
  return Buffer.concat([header, png]);
}

async function main() {
  await mkdir(pub('icons'), { recursive: true });

  await copyFile(brand('favicon.svg'), pub('favicon.svg'));

  const favicon32 = await sharp(await renderSvg(brand('logo-mark-small.svg'), 32))
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(pub('favicon.ico'), icoFromPng(favicon32, 32));

  await writeFile(pub('icons/icon-192.png'), await appIcon(192, MARK_SCALE, CORNER_RADIUS));
  await writeFile(pub('icons/icon-512.png'), await appIcon(512, MARK_SCALE, CORNER_RADIUS));
  await writeFile(pub('icons/icon-maskable-512.png'), await appIcon(512, MASKABLE_MARK_SCALE));
  await writeFile(pub('icons/apple-touch-icon.png'), await appIcon(180, MARK_SCALE));

  const og = await sharp(await readFile(brand('og-image.svg')), { density: 72 })
    .resize(1200, 630)
    .flatten({ background: '#0b1420' })
    .png(PNG_OPTIONS)
    .toBuffer();
  await writeFile(pub('og-image.png'), og);
}

await main();
