import { describe, expect, it } from "vitest";
import { safeNext, slugify, SLUG_RE } from "../slug";
import { onboardingSchema, sniffLogoType } from "../validation/business";

describe("slugify", () => {
  it("handles punctuation, accents and spacing", () => {
    expect(slugify("Lily's Nails & Beauty!")).toBe("lily-s-nails-beauty");
    expect(slugify("  Café  Crème ")).toBe("cafe-creme");
  });
  it("caps at 40 chars without trailing hyphen", () => {
    const s = slugify("a".repeat(39) + " b");
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith("-")).toBe(false);
  });
  it("matches the DB slug check for normal names", () => {
    expect(SLUG_RE.test(slugify("Lily Nails"))).toBe(true);
  });
});

describe("safeNext", () => {
  it("allows same-site paths only", () => {
    expect(safeNext("/onboarding")).toBe("/onboarding");
    expect(safeNext("//evil.com")).toBe("/dashboard");
    expect(safeNext("https://evil.com")).toBe("/dashboard");
    expect(safeNext("/\\evil.com")).toBe("/dashboard");
    expect(safeNext(null, "/x")).toBe("/x");
  });
});

describe("onboardingSchema", () => {
  const ok = { name: "Lily Nails", slug: "lily-nails", staffName: "Lily" };
  it("accepts valid input and lowercases the slug", () => {
    expect(onboardingSchema.parse({ ...ok, slug: "Lily-Nails" }).slug).toBe("lily-nails");
  });
  it.each(["ab", "-lily", "lily nails", "lily_nails", "admin"])("rejects slug %s", (slug) => {
    expect(onboardingSchema.safeParse({ ...ok, slug }).success).toBe(false);
  });
});

describe("sniffLogoType", () => {
  it("detects real signatures and rejects others", () => {
    expect(sniffLogoType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe("image/png");
    expect(sniffLogoType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffLogoType(new TextEncoder().encode("<svg xmlns=...>"))).toBeNull();
  });
});
