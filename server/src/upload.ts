import multer from "multer";

/**
 * Shared multer instance for memory-buffered uploads (media library + DPDP
 * proofs). Files are written straight to disk/DB after optional processing;
 * 120MB per file accommodates raw video takes without rejecting the clinic's
 * existing library re-uploads.
 *
 * NOTE: this middleware must always run AFTER authentication/authorisation for
 * a route — parsing request bodies before auth would let anonymous callers
 * force the process to buffer large payloads (DoS).
 */
export const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? "120");

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 10 },
});
