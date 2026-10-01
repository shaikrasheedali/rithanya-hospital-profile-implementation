/* Try to fetch the same Pexels clip used by the Hero as the gallery video file.
 * Run: npx tsx scripts/fetch-seed-video.ts
 * Skips gracefully if offline (UI degrades via onError fallback).
 */
import fs from "node:fs/promises";
import path from "node:path";

const SEED_DIR = path.join(process.cwd(), "public", "seed");
const DEST = path.join(SEED_DIR, "clip-iv-drip.mp4");
const URLS = [
  "https://www.pexels.com/download/video/4352136/",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
];

async function main() {
  const st = await fs.stat(DEST).catch(() => null);
  if (st && st.size > 100_000) {
    console.log(`video already real (${st.size} bytes) — skipping`);
    return;
  }
  for (const u of URLS) {
    try {
      console.log(`trying ${u}`);
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 90_000);
      const res = await fetch(u, { signal: ctrl.signal, redirect: "follow" });
      clearTimeout(t);
      if (!res.ok) {
        console.log(`HTTP ${res.status} — next`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const ctype = res.headers.get("content-type") ?? "";
      console.log(`got ${buf.length} bytes (${ctype})`);
      if (buf.length < 100_000) {
        console.log("too small — probably an HTML page, next");
        continue;
      }
      if (!ctype.includes("video") && !ctype.includes("octet-stream")) {
        // Pexels download endpoint may return video bytes with generic type; accept by size + magic
        const magic = buf.subarray(4, 12).toString("ascii");
        if (!magic.includes("ftyp")) {
          console.log(`not an mp4 (magic ${JSON.stringify(magic)}) — next`);
          continue;
        }
      }
      await fs.mkdir(SEED_DIR, { recursive: true });
      await fs.writeFile(DEST, buf);
      console.log(`saved real video (${buf.length} bytes)`);
      return;
    } catch (e) {
      console.log(`failed: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log("could not fetch a real video — keeping stub (UI fallback covers it)");
}

main();
