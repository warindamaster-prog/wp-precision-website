import { z } from "zod";
import { SLUG_RE } from "@/lib/slug";

export const RESERVED_SLUGS = new Set(["admin", "api", "app", "login", "signup", "dashboard", "www"]);

export const onboardingSchema = z.object({
  name: z.string().trim().min(1, "Enter your business name").max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_RE, "Use 3-40 letters, numbers or hyphens, starting with a letter or number")
    .refine((s) => !RESERVED_SLUGS.has(s), "That web address is reserved"),
  staffName: z.string().trim().min(1, "Enter your name").max(100),
});

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;

/** Check the real file signature, not just the client-supplied MIME type. */
export function sniffLogoType(bytes: Uint8Array): keyof typeof LOGO_TYPES | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  return null;
}
