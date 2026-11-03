/**
 * glossarygen types.
 *
 * glossarygen builds a project glossary from caller-supplied
 * term occurrences only. For each occurrence the caller
 * supplies the term as found (an identifier or a doc
 * phrase), where it was found, and optionally a definition
 * the docs carry for it. From that data alone, as pure
 * local computation, glossarygen reports:
 *
 *   - one glossary entry per distinct normalized term:
 *     its display form, its distinct sources sorted
 *     code-unit ascending, how many occurrences merged
 *     into it, and the first supplied definition, if any
 *   - counts: how many occurrences were supplied, how
 *     many distinct terms they merged into, and how many
 *     of those carry a definition versus not
 *
 * Normalization is pinned (see the core module): separator
 * runs become spaces, camel humps are split (including the
 * acronym boundary), words are lowercased, and the term key
 * is the words joined with a single space. Nothing is
 * defined or fetched by the tool.
 */

/** One merged glossary entry. */
export interface GlossaryEntry {
  /** Display form: the term key with its first character uppercased. */
  term: string;
  /** Distinct source strings across the merged occurrences, sorted code-unit ascending. */
  sources: string[];
  /** Number of occurrences merged into this entry. */
  occurrences: number;
  /** First supplied definition in input order, or null when none supplied one. */
  definition: string | null;
}

/** Tallies for the built glossary. */
export interface GlossaryCounts {
  /** Number of term occurrences supplied. */
  supplied: number;
  /** Number of distinct terms after merging. */
  distinct_terms: number;
  /** Entries carrying a definition. */
  with_definition: number;
  /** Entries without a definition. */
  without_definition: number;
}

/** The full built glossary. */
export interface GlossaryResult {
  /** One entry per distinct term, sorted by term key code-unit ascending. */
  entries: GlossaryEntry[];
  /** Supplied / distinct / definition tallies. */
  counts: GlossaryCounts;
}
