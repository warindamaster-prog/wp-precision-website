/** "12.50" -> 1250. Whole pounds and up to 2 decimals, max £9,999.99. Never uses floats. */
export function parsePounds(input: string): number | null {
  const m = /^(\d{1,4})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!m) return null;
  const pence = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || 0);
  return pence;
}

export function formatPence(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

/** 1250 -> "12.50" for form inputs. */
export function penceToInput(pence: number): string {
  return (pence / 100).toFixed(2);
}
