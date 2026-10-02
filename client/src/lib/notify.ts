import { toast } from "sonner";

/** Centralised user-facing notifications. All errors/success must go through sonner. */
export function notifySuccess(message: string) {
  toast.success(message);
}

export function notifyError(message: string) {
  toast.error(message || "Something went wrong — please try again.");
}

export function notifyInfo(message: string) {
  toast.info(message);
}

/** Extract a readable message from unknown errors. */
export function errorMessage(err: unknown, fallback = "Something went wrong — please try again."): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
}
