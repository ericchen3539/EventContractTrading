/**
 * API utilities. In production, avoid leaking internal error details to clients.
 */

const isProduction = process.env.NODE_ENV === "production";

/**
 * Returns a safe error message for API responses.
 * In production, returns a generic message. In dev, returns the actual error message.
 */
export function getSafeErrorMessage(err: unknown, fallback = "Internal server error"): string {
  if (!isProduction) {
    return err instanceof Error ? err.message : String(err ?? fallback);
  }
  return fallback;
}
