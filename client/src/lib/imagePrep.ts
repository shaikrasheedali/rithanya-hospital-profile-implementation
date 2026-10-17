/**
 * Client-side image pre-processing.
 *
 * Big camera files (2-15MB JPEG/PNG) are downscaled and re-encoded to WebP in
 * the browser BEFORE upload. The transfer is typically 5-15x smaller, which is
 * the dominant cost when uploading over a slow uplink, and the server can then
 * store the (already WebP, metadata-free) result without a second re-encode.
 *
 * Anything unexpected — undecodable formats (HEIC), huge files, missing canvas
 * support — falls back to the original file; the server pipeline still handles
 * it exactly as before.
 */

const MAX_DIM = 2560; // matches the server-side optimisation envelope
const CLIENT_QUALITY = 0.9; // above the server's 0.82 — avoids visible loss
const SKIP_UNDER_BYTES = 300 * 1024; // already small enough; don't touch it
const MAX_INPUT_BYTES = 60 * 1024 * 1024; // canvas memory guard

const PROCESSABLE_TYPES = new Set(["image/jpeg", "image/png"]);

async function prepareOne(file: File): Promise<File> {
  if (!PROCESSABLE_TYPES.has(file.type)) return file;
  if (file.size <= SKIP_UNDER_BYTES || file.size > MAX_INPUT_BYTES) return file;
  if (typeof createImageBitmap !== "function") return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_DIM / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));

    const useOffscreen = typeof OffscreenCanvas !== "undefined";
    const canvas: OffscreenCanvas | HTMLCanvasElement = useOffscreen
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement("canvas"), { width: w, height: h });
    const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
    if (!ctx) return file;
    ctx.drawImage(bmp as unknown as CanvasImageSource, 0, 0, w, h);
    if (typeof bmp.close === "function") bmp.close();

    let blob: Blob | null;
    if (useOffscreen && typeof (canvas as OffscreenCanvas).convertToBlob === "function") {
      blob = await (canvas as OffscreenCanvas).convertToBlob({ type: "image/webp", quality: CLIENT_QUALITY });
    } else {
      blob = await new Promise<Blob | null>((resolve) => (canvas as HTMLCanvasElement).toBlob(resolve, "image/webp", CLIENT_QUALITY));
    }
    if (!blob || blob.size === 0 || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp", lastModified: Date.now() });
  } catch {
    return file; // e.g. HEIC or a codec the browser can't draw — upload as-is
  }
}

/** Best-effort parallel prep; never rejects — falls back per file. */
export async function prepareFilesForUpload(files: File[]): Promise<File[]> {
  return Promise.all(files.map(prepareOne));
}
