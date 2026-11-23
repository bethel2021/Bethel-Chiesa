export interface PastoralPhoneEntry {
  raw: string;
  prefix: string;
  phone: string;
  suffix: string;
  telHref: string | null;
}

function toEntry(segment: string): PastoralPhoneEntry {
  const trimmed = segment.trim();
  const match = trimmed.match(/^(.*?)(\+?\d[\d\s\-]{4,}\d)(.*)$/);
  if (!match) {
    return {
      raw: trimmed,
      prefix: trimmed,
      phone: '',
      suffix: '',
      telHref: null,
    };
  }

  const cleanDigits = match[2].replace(/[^\d+]/g, '');
  return {
    raw: trimmed,
    prefix: match[1],
    phone: match[2],
    suffix: match[3],
    telHref: cleanDigits.length >= 5 ? `tel:${cleanDigits}` : null,
  };
}

/**
 * Splits a pastoralPhone string containing one or more contacts into individual entries
 * so mobile screens can render each person & phone number cleanly on its own line.
 */
export function parsePastoralPhoneEntries(raw: string): PastoralPhoneEntry[] {
  const input = String(raw ?? '').trim();
  if (!input) return [];

  // 1. Split on explicit multi-contact delimiters (newline, slash, pipe, semicolon, CJK/comma)
  const explicitParts = input
    .split(/[\n\r/／|｜;；、，,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (explicitParts.length > 1) {
    return explicitParts.map(toEntry);
  }

  // 2. Fallback: split when multiple people + phone numbers are space-separated
  // e.g. "林牧师 3331234567 陈弟兄 3337654321"
  const phoneRuns = input.match(/\+?\d[\d\s\-]{4,}\d/g) ?? [];
  if (phoneRuns.length > 1) {
    const spaceSplitParts = input
      .split(/(?<=\d)\s+(?=[\u4e00-\u9fa5A-Za-z])/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (spaceSplitParts.length > 1) {
      return spaceSplitParts.map(toEntry);
    }
  }

  return [toEntry(input)];
}
