/**
 * glossarygen core: build a project glossary from
 * caller-supplied term occurrences.
 *
 *   buildGlossary(args) -> { entries, counts }
 *
 * Normalization of a name into its word list, in this
 * exact order (pinned):
 *   1. replace every run of "_" or "-" with a single space;
 *   2. split camel humps: insert a space before an
 *      uppercase letter that follows a lowercase letter or
 *      a digit, and before an uppercase letter that is
 *      preceded by an uppercase letter and followed by a
 *      lowercase letter (the acronym boundary:
 *      "HTTPServer" -> "HTTP Server");
 *   3. split on whitespace runs and drop empty words;
 *   4. lowercase every word.
 * The term key is the words joined with a single space.
 * Worked examples: "parseHTTPResponse" -> "parse http
 * response"; "HTTPServer" -> "http server"; "user_id" ->
 * "user id"; "UserID" -> "user id"; "already spaced" ->
 * "already spaced".
 *
 * Occurrences with equal keys merge into one entry
 * {term, sources, occurrences, definition} in that key
 * order: term is the display form (the key with its first
 * character uppercased); sources are the distinct source
 * strings across the merged occurrences, sorted code-unit
 * ascending; occurrences is the merge count; definition
 * is the first non-absent definition in input order
 * across the merged occurrences, or null when none
 * supplies one (an empty-string definition counts as
 * supplied and echoes verbatim). Entries are sorted by
 * key code-unit ascending.
 *
 * Validation is strict and path-naming: any malformed
 * input throws an Error naming the offending path and no
 * partial result is produced. A name whose key is the
 * empty string is a validation error naming its path.
 * Unknown extra fields are ignored, including inside
 * items; a non-object top-level argument is treated as {}.
 */
import type {
  GlossaryCounts,
  GlossaryEntry,
  GlossaryResult,
} from "./types.js";

export const VERSION = "0.1.0";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUpper(ch: string): boolean {
  return ch >= "A" && ch <= "Z";
}

function isLower(ch: string): boolean {
  return ch >= "a" && ch <= "z";
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

/**
 * Normalize a term name into its key, following the pinned
 * steps in order.
 */
export function normalizeTermKey(name: string): string {
  // (1) Every run of "_" or "-" becomes a single space.
  const separated = name.replace(/[_-]+/g, " ");
  // (2) Split camel humps, including the acronym boundary.
  let spaced = "";
  for (let i = 0; i < separated.length; i++) {
    const ch = separated[i];
    if (isUpper(ch) && i > 0) {
      const prev = separated[i - 1];
      const next = i + 1 < separated.length ? separated[i + 1] : "";
      if (
        isLower(prev) ||
        isDigit(prev) ||
        (isUpper(prev) && next !== "" && isLower(next))
      ) {
        spaced += " ";
      }
    }
    spaced += ch;
  }
  // (3) Split on whitespace runs and drop empty words;
  // (4) lowercase every word. The key joins with one space.
  return spaced
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => word.toLowerCase())
    .join(" ");
}

interface TermFacts {
  key: string;
  source: string;
  definition: string | undefined;
}

function parseTerm(item: unknown, index: number): TermFacts {
  const at = `terms[${index}]`;
  if (!isRecord(item)) throw new Error(`${at} must be an object`);

  if (item.name === undefined) throw new Error(`${at}.name is required`);
  if (typeof item.name !== "string" || item.name.length === 0) {
    throw new Error(`${at}.name must be a non-empty string`);
  }

  if (item.source === undefined) throw new Error(`${at}.source is required`);
  if (typeof item.source !== "string" || item.source.length === 0) {
    throw new Error(`${at}.source must be a non-empty string`);
  }

  let definition: string | undefined;
  if (item.definition !== undefined) {
    if (typeof item.definition !== "string") {
      throw new Error(`${at}.definition must be a string`);
    }
    definition = item.definition;
  }

  const key = normalizeTermKey(item.name);
  if (key.length === 0) {
    throw new Error(`${at}.name produces an empty term`);
  }

  return { key, source: item.source, definition };
}

/** Build a project glossary from supplied term occurrences. */
export function buildGlossary(args: unknown): GlossaryResult {
  const raw: Record<string, unknown> = isRecord(args) ? args : {};

  if (raw.terms === undefined) throw new Error("terms is required");
  if (!Array.isArray(raw.terms) || raw.terms.length === 0) {
    throw new Error("terms must be a non-empty array");
  }

  const facts = raw.terms.map((item, i) => parseTerm(item, i));

  interface Merged {
    key: string;
    sources: Set<string>;
    occurrences: number;
    definition: string | null;
    hasDefinition: boolean;
  }
  const byKey = new Map<string, Merged>();
  for (const f of facts) {
    const existing = byKey.get(f.key);
    if (existing) {
      existing.occurrences += 1;
      existing.sources.add(f.source);
      if (!existing.hasDefinition && f.definition !== undefined) {
        existing.definition = f.definition;
        existing.hasDefinition = true;
      }
    } else {
      byKey.set(f.key, {
        key: f.key,
        sources: new Set([f.source]),
        occurrences: 1,
        definition: f.definition !== undefined ? f.definition : null,
        hasDefinition: f.definition !== undefined,
      });
    }
  }

  const entries: GlossaryEntry[] = [...byKey.keys()].sort().map((key) => {
    const merged = byKey.get(key)!;
    return {
      term: key.charAt(0).toUpperCase() + key.slice(1),
      sources: [...merged.sources].sort(),
      occurrences: merged.occurrences,
      definition: merged.definition,
    };
  });

  const withDefinition = entries.filter((e) => e.definition !== null).length;
  const counts: GlossaryCounts = {
    supplied: facts.length,
    distinct_terms: entries.length,
    with_definition: withDefinition,
    without_definition: entries.length - withDefinition,
  };

  return { entries, counts };
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
