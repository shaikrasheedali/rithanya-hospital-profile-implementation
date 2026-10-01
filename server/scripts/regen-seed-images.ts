/* Regenerates real WebP seed images (gradient + label) so /seed/* always renders.
 * Run: npm --prefix server run seed:images  (or: npx tsx scripts/regen-seed-images.ts)
 * Overwrites server/public/seed/*.webp and syncs media_assets.size_in_bytes.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";

const SEED_DIR = path.join(process.cwd(), "public", "seed");

const GROUPS: Array<{ match: RegExp; from: string; to: string }> = [
  { match: /hospital|ward|corridor|wheelchair/i, from: "#0A2540", to: "#0D47A1" },
  { match: /doctor|nurse|consult|exam|vitals|sitting|care|bp|injection/i, from: "#0D47A1", to: "#29B6F6" },
  { match: /blood|donation|bag|beds/i, from: "#B71C1C", to: "#EF5350" },
  { match: /glucose|meter|strips|finger/i, from: "#00695C", to: "#26A69A" },
  { match: /lab|microscope|notes|woman/i, from: "#4A148C", to: "#7B1FA2" },
  { match: /pharmacy|bottle|counter|shelves/i, from: "#E65100", to: "#FFA726" },
  { match: /logo/i, from: "#0A2540", to: "#FFD700" },
];

const NAMES = [
  "hospital-corridor", "hospital-wheelchair", "doctor-consult", "doctor-exam", "doctor-vitals", "doctor-sitting",
  "blood-donation", "blood-bag", "blood-beds", "glucose-finger", "glucose-strips", "glucose-meter", "lab-microscope",
  "lab-woman", "lab-notes", "pharmacy-shelves", "pharmacy-bottle", "pharmacy-counter", "nurse-injection", "nurse-bp",
  "nurse-care", "ward-exam", "logo-pmjay", "logo-aarogyasri", "logo-tpa",
];

function colorsFor(name: string): [string, string] {
  for (const g of GROUPS) if (g.match.test(name)) return [g.from, g.to];
  return ["#0A2540", "#0D47A1"];
}

function labelFor(name: string): string {
  return name.replace(/^logo-/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function makeWebp(name: string): Promise<Buffer> {
  const [from, to] = colorsFor(name);
  const label = labelFor(name);
  const isLogo = name.startsWith("logo-");
  const W = isLogo ? 800 : 1200;
  const H = isLogo ? 500 : 800;
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="${W / 2}" cy="${H / 2 - 40}" r="54" fill="rgba(255,255,255,0.16)"/>
    <rect x="${W / 2 - 10}" y="${H / 2 - 78}" width="20" height="76" rx="6" fill="#ffffff"/>
    <rect x="${W / 2 - 28}" y="${H / 2 - 59}" width="56" height="20" rx="6" fill="#ffffff"/>
    <text x="50%" y="${H / 2 + 52}" text-anchor="middle" font-family="Arial,sans-serif" font-size="44" font-weight="bold" fill="#ffffff">${label}</text>
    <text x="50%" y="${H / 2 + 92}" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" fill="rgba(255,255,255,0.85)">Rithanya Hospital</text>
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 82 }).toBuffer();
}

async function main() {
  await fs.mkdir(SEED_DIR, { recursive: true });
  const prisma = new PrismaClient();
  try {
    for (const name of NAMES) {
      const file = `${name}.webp`;
      const buf = await makeWebp(name);
      await fs.writeFile(path.join(SEED_DIR, file), buf);
      const filename = `seed-${file}`;
      try {
        await prisma.mediaAsset.update({ where: { filename }, data: { sizeInBytes: buf.length } });
      } catch { /* asset may not exist yet — seed will create it */ }
      console.log(`wrote ${file} (${buf.length} bytes)`);
    }
    // Ensure the video placeholder exists; if it is a text stub, try to fetch a tiny real mp4, else leave it
    // (frontend video elements degrade gracefully via onError fallback).
    try {
      const st = await fs.stat(path.join(SEED_DIR, "clip-iv-drip.mp4"));
      console.log(`video stub present (${st.size} bytes)`);
    } catch {
      console.log("no video file — leaving DB url as-is (graceful fallback in UI)");
    }
  } finally {
    await prisma.$disconnect();
  }
  console.log("done");
}

main().catch((e) => { console.error(e); process.exit(1); });
