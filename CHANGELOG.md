# Changelog

## 0.1.0 (2026-10-27)

- Initial release: `build_glossary` MCP tool and `build`
  CLI command building a project glossary from
  caller-supplied term occurrences only; nothing is
  defined or fetched by the tool.
- Pinned name normalization, in order: separator runs
  (`_` / `-`) become a single space; camel humps are
  split, including the acronym boundary (`HTTPServer`
  becomes `http server`); words are lowercased and
  joined with a single space to form the term key.
- Occurrences with equal keys merge into one entry:
  the display term (key with its first character
  uppercased), distinct sources sorted code-unit
  ascending, the merge count, and the first supplied
  definition in input order (an empty-string definition
  counts as supplied), or `null`. Entries are sorted by
  key, and counts report supplied, distinct terms, and
  the with- / without-definition split.
- Path-naming validation errors for malformed input,
  including a name that normalizes to an empty term; no
  partial results on invalid input.
