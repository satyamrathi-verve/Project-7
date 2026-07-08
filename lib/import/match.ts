import type { EntityConfig, FieldMapping, MappingConfidence } from "./types";

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Classic edit-distance, used only as a last-resort fuzzy fallback. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

function similarity(a: string, b: string): number {
  const dist = levenshtein(a, b);
  const longest = Math.max(a.length, b.length) || 1;
  return 1 - dist / longest;
}

/**
 * Auto-maps CSV headers to an entity's target fields.
 * Tries, in order: exact key match, case-insensitive match, synonym match,
 * then fuzzy (edit-distance) match — each tier assigns a confidence score so the
 * UI can show the user how sure it is.
 */
export function autoMapHeaders(headers: string[], entity: EntityConfig): { mapping: FieldMapping; confidence: MappingConfidence } {
  const mapping: FieldMapping = {};
  const confidence: MappingConfidence = {};
  const usedFields = new Set<string>();

  const fieldLookup = entity.fields.map((f) => ({
    field: f,
    normalizedKey: normalize(f.key),
    normalizedLabel: normalize(f.label),
    normalizedSynonyms: f.synonyms.map(normalize),
  }));

  for (const header of headers) {
    const normHeader = normalize(header);
    if (!normHeader) {
      mapping[header] = null;
      confidence[header] = 0;
      continue;
    }

    let best: { key: string; score: number } | null = null;

    for (const { field, normalizedKey, normalizedLabel, normalizedSynonyms } of fieldLookup) {
      if (usedFields.has(field.key)) continue;

      let score = 0;
      if (normHeader === normalizedKey || normHeader === normalizedLabel) {
        score = 100;
      } else if (normalizedSynonyms.includes(normHeader)) {
        score = 92;
      } else {
        const sims = [normalizedKey, normalizedLabel, ...normalizedSynonyms].map((s) => similarity(normHeader, s));
        const maxSim = Math.max(...sims, 0);
        if (maxSim >= 0.72) score = Math.round(50 + maxSim * 35);
      }

      if (score > 0 && (!best || score > best.score)) {
        best = { key: field.key, score };
      }
    }

    if (best) {
      mapping[header] = best.key;
      confidence[header] = best.score;
      usedFields.add(best.key);
    } else {
      mapping[header] = null;
      confidence[header] = 0;
    }
  }

  return { mapping, confidence };
}

export function confidenceLabel(score: number): { label: string; tone: "high" | "medium" | "low" | "none" } {
  if (score >= 90) return { label: "Exact match", tone: "high" };
  if (score >= 75) return { label: "Likely match", tone: "medium" };
  if (score > 0) return { label: "Possible match", tone: "low" };
  return { label: "Unmapped", tone: "none" };
}
