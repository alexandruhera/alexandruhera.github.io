// Build the brand pack from a master mark SVG.
//
//   node brand/make-pack.mjs brand/master.svg [outDir=brand/pack]
//
// Master convention: structure strokes use currentColor, accent is the
// literal ACCENT hex below (brand orange; v3-era backups used #4E9CD5). Outputs:
//   favicon.svg          theme-aware (prefers-color-scheme flips the ink)
//   favicon.ico          16 + 32 px PNG frames
//   apple-touch-icon.png 180 px on solid --bg tile
//   icon-192.png / icon-512.png
//   logo.svg             master passthrough (inline on the website)
//   logo-mono.svg        one-color: accent collapsed into currentColor
//   logo-mono-1200.png   transparent dark-ink raster for docs (~600 dpi at 5 cm)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"));
const sharp = require("sharp");

const ACCENT = "#DB5C5C";
const INK_DARK = "#16181d";   // structure ink on light/transparent grounds
const INK_LIGHT = "#e6e8ee";  // structure ink on the dark bg tile
const BG_DARK = "#15161b";    // site --bg, dark scheme

const src = process.argv[2];
if (!src) {
  console.error("usage: node brand/make-pack.mjs <master.svg> [outDir]");
  process.exit(1);
}
const outDir = process.argv[3] ?? join(dirname(src), "pack");
await mkdir(outDir, { recursive: true });

// Strip XML comments: notes in the backups contain "--" (e.g. --accent),
// which librsvg rejects as malformed XML.
const master = (await readFile(src, "utf8")).replace(/<!--[\s\S]*?-->/g, "").trim();
const inked = (ink) => master.replaceAll("currentColor", ink);
const mono = (ink) => master.replaceAll(ACCENT, "currentColor").replaceAll("currentColor", ink);

// Square raster: render at target height, pad to a square transparent canvas.
async function square(svg, size, background = { r: 0, g: 0, b: 0, alpha: 0 }) {
  return sharp(Buffer.from(svg), { density: 300 })
    .resize(size, size, { fit: "contain", background })
    .png()
    .toBuffer();
}

// --- favicon.svg: theme-aware via a style block inside the SVG
const themed = master.replace(
  "</svg>",
  `<style>svg{color:${INK_DARK}}@media(prefers-color-scheme:dark){svg{color:${INK_LIGHT}}}</style></svg>`
);
await writeFile(join(outDir, "favicon.svg"), themed);

// --- favicon.ico: PNG-embedded frames (valid modern ICO)
const frames = await Promise.all([16, 32].map((s) => square(inked(INK_DARK), s)));
await writeFile(join(outDir, "favicon.ico"), buildIco(frames, [16, 32]));

// --- touch/manifest icons: mark at ~62% on a solid dark tile
async function tile(size) {
  const mark = await square(inked(INK_LIGHT), Math.round(size * 0.62));
  return sharp({ create: { width: size, height: size, channels: 4, background: BG_DARK } })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toBuffer();
}
await writeFile(join(outDir, "apple-touch-icon.png"), await tile(180));
await writeFile(join(outDir, "icon-192.png"), await tile(192));
await writeFile(join(outDir, "icon-512.png"), await tile(512));

// --- website + document versions
await writeFile(join(outDir, "logo.svg"), master);
await writeFile(join(outDir, "logo-mono.svg"), master.replaceAll(ACCENT, "currentColor"));
await writeFile(join(outDir, "logo-mono-1200.png"), await square(mono(INK_DARK), 1200));

// --- og-image: 1200×630 social card (mark + name + strapline)
const OG_MUTED = "#8f95a3";
const ogSvg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="${BG_DARK}"/>
  <g transform="translate(150,147) scale(6.5)" color="${INK_LIGHT}">${master
    .replace(/<svg[^>]*>/, "")
    .replace("</svg>", "")
    .replaceAll("currentColor", INK_LIGHT)}</g>
  <text x="560" y="300" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold"
    font-size="64" fill="${INK_LIGHT}">Alexandru Hera</text>
  <text x="563" y="360" font-family="DejaVu Sans Mono, Menlo, monospace"
    font-size="26" fill="${OG_MUTED}">security operations · threat detection</text>
  <text x="563" y="410" font-family="DejaVu Sans Mono, Menlo, monospace"
    font-size="26" fill="${ACCENT}">alexandruhera.com</text>
</svg>`;
await writeFile(
  join(outDir, "og-image.png"),
  await sharp(Buffer.from(ogSvg)).resize(1200, 630).png().toBuffer()
);

console.log(`pack written to ${outDir}/`);

// Minimal ICO container around PNG frames.
function buildIco(pngs, sizes) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  pngs.forEach((png, i) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], 0); // width
    e.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], 1); // height
    e.writeUInt8(0, 2);        // palette
    e.writeUInt8(0, 3);        // reserved
    e.writeUInt16LE(1, 4);     // planes
    e.writeUInt16LE(32, 6);    // bpp
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  });
  return Buffer.concat([header, ...entries, ...pngs]);
}
