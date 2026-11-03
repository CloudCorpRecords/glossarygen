# glossarygen — Build Report

MCP Rebuild 1000, Batch 19. Original program build from the
packages-100 plan (cluster G #86), built from the spec in
`~/workspace/mcp-rebuild-100/specs-batch19/glossarygen.md`
(read first). There is no external original; the tool surface
is the program's defined spec. Local build only — nothing
pushed or published.

Identity: repo `glossarygen`, npm `@reneturcios/glossarygen`,
MCP name `io.github.CloudCorpRecords/glossarygen`, version
`0.1.0`, bin `glossarygen` → `dist/cli.js`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json`, `server.json` (description "Build a project
  glossary from supplied code and doc terms, merged, with
  source links." — 85 chars, verified by count; npm entry
  carries `version: 0.1.0`; OCI entry
  `ghcr.io/cloudcorprecords/glossarygen:0.1.0` carries **no**
  `version` field), `Dockerfile` (node:20-alpine two-stage,
  label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/glossarygen"`),
  `tsconfig.json` (byte-identical to the reference, verified
  by diff), `.gitignore`, `LICENSE` (MIT, Copyright (c) 2026
  Rene Turcios), `README.md` (fresh text), `CHANGELOG.md`
  (single 0.1.0 entry, 2026-10-27), `package-lock.json`
  (Route 3, see below)
- `src/index.ts`, `src/cli.ts` (`build --input <args.json>`
  where the file holds the full arguments object, `mcp`,
  `--version`; exit 2 usage / 1 runtime error, argument
  validation before any file read), `src/mcp.ts`,
  `src/types.ts`, `src/glossarygen.ts` (core,
  `VERSION = "0.1.0"`, `buildGlossary`, `formatPayload`)
- `test/glossarygen.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (publish-container `IMAGE = ghcr.io/cloudcorprecords/glossarygen`,
  smoke-test server-name assertion `glossarygen`; the other
  three workflows are byte-identical to the reference,
  verified by diff)

Plus the parity fixture at
`harness/fixtures/glossarygen-tools-original.json`, labelled
as a program spec from the packages-100 plan cluster G #86.

## Tools implemented (1)

- `build_glossary` — arguments: `terms` (array, required, at
  least 1 item). Each term item: `name` (string, required,
  non-empty), `source` (string, required, non-empty), and
  `definition` (string, optional). Required is exactly
  `["terms"]` at the top level and `["name", "source"]` per
  item.

  Normalization is pinned, in this exact order: (1) every
  run of `_` or `-` becomes a single space; (2) camel humps
  are split — a space before an uppercase letter that
  follows a lowercase letter or a digit, and before an
  uppercase letter preceded by an uppercase letter and
  followed by a lowercase letter (the acronym boundary);
  (3) split on whitespace runs, dropping empty words;
  (4) lowercase every word. The key is the words joined
  with a single space.

  Returns `{entries, counts}`, where `entries` holds one
  `{term, sources, occurrences, definition}` per distinct
  key, sorted by key code-unit ascending — `term` is the
  display form (the key with its first character
  uppercased), `sources` are the distinct source strings
  across the merged occurrences sorted code-unit ascending,
  `occurrences` is the merge count, and `definition` is the
  first non-absent definition in input order (an
  empty-string definition counts as supplied and echoes
  verbatim) or `null` — and `counts` is `{supplied,
  distinct_terms, with_definition, without_definition}` in
  that key order.

  The fixture literal
  (`harness/fixtures/glossarygen-tools-original.json`) and
  the `src/mcp.ts` literal are identical, with no `$schema`
  and no `additionalProperties` — confirmed by the parity
  run below.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with an
  explicit inputSchema literal exactly matching the
  fixture, per the standing fleet rule (no McpServer/zod
  schema conversion). Every `tools/call` is validated by
  the core itself, so the MCP and CLI paths share one
  validation implementation; the core takes the full
  arguments object.
- Validation is path-naming and total: a missing, non-array,
  or empty `terms`; a non-object item; a missing, empty, or
  non-string `name` or `source`; a `definition` present but
  not a string; or a name normalizing to an empty key throws
  an Error naming the offending path (e.g. `terms[1].name
  produces an empty term`) and produces no partial result
  (MCP: `isError`; CLI: exit 1). Unknown extra fields are
  ignored, including inside items; a non-object top-level
  argument is treated as {}.

## Verification (foreground, this session)

- `npm test` (`tsx --test test/*.test.ts`): **48 tests,
  48 pass, 0 fail** — all five pinned worked examples
  (`parseHTTPResponse` → "parse http response",
  `HTTPServer` → "http server", `user_id` → "user id",
  `UserID` → "user id", "already spaced" → "already
  spaced"); separator runs (mixed `_`/`-` runs collapsing,
  leading/trailing separators, whitespace collapsing);
  camel splitting in both directions (lowercase→uppercase,
  digit→uppercase, the acronym boundary on `HTTPServer` /
  `JSONData` / `ABCd`, and the non-boundary of a trailing
  acronym run on `userID` / `parseXML`); the `user_id` /
  `UserID` merge and four-spelling merges; source dedupe,
  code-unit ascending sort across a mixed-case set, and
  verbatim source echo; first-definition-wins, including
  the empty-string definition counting as supplied and
  beating a later real one, and verbatim definition echo;
  display capitalization; entry ordering by key; entry and
  counts key order; counts tallies; the empty-key error in
  the spec's example shape; and every validation path
  (terms missing / non-array / empty, non-object items,
  name and source missing / empty / non-string, definition
  non-string, non-object top-level treated as {}, unknown
  extras ignored, no partial result).
- `npx tsc --noEmit` → exit 0; `npm run build` produced
  `dist/` with all 15 outputs.
- `dist/cli.js --version` → `0.1.0`; unknown command exits
  2 with usage; `build` with no `--input` exits 2;
  `build --input <valid file>` exits 0 and prints the
  hand-checked glossary for the input `{"terms":
  [{"name": "user_id", "source": "src/user.ts"},
  {"name": "UserID", "source": "docs/api.md",
  "definition": "Stable identifier for a user account."},
  {"name": "parseHTTPResponse", "source": "src/http.ts"}]}`
  — "Parse http response" (1 occurrence, definition null)
  first by key, then the merged "User id" with sources
  `["docs/api.md", "src/user.ts"]`, 2 occurrences, and the
  supplied definition, counts supplied 3, distinct_terms
  2, with_definition 1, without_definition 1;
  `build --input <invalid file>` (second term's name
  `"___"`) exits 1 with
  `error: terms[1].name produces an empty term`.
- Parity: `harness/parity.py` vs
  `harness/fixtures/glossarygen-tools-original.json` →
  **PASS, parity 100.0, identical_tools 1/1** (run with
  the rebuild path as an absolute path; the harness does
  not expand a `~` inside the quoted stdio command
  string). Report saved under `parity-out/`.

## Lockfile status

`package-lock.json` generated clean via Route 3 (in the
build directory with no `node_modules` present, offline
`npm install --package-lock-only --ignore-scripts
--offline`), verified: parses, name
`@reneturcios/glossarygen`, **128 package entries**. The
subsequent offline `npm install --ignore-scripts
--offline`, build, tests, and parity all ran against
this lockfile's tree.

## Gaps / honest notes

- **Pinned judgement calls** (each with a dedicated test
  where applicable): (1) the empty-key error wording is
  the spec's own example, `terms[<i>].name produces an
  empty term`, applied uniformly to separator-only and
  whitespace-only names (a whitespace-only name passes
  the non-empty-string check, then fails on its empty
  key); (2) field validation for an item runs in field
  order (name, source, definition) before the empty-key
  check, so a malformed sibling field is named first —
  the spec does not order these, and the empty-key tests
  all use otherwise-valid items; (3) key, entry, and
  source ordering is the default JavaScript string sort
  (code-unit ascending), pinned with a mixed-case source
  set where capitals sort before lowercase; (4) unknown
  extra fields are ignored rather than rejected, at the
  top level and inside items (the spec says so); (5) a
  non-object top-level arguments value is treated as an
  empty object, so it fails as `terms is required`;
  (6) error-message wording follows the fleet's
  path-naming pattern, distinguishing a missing field
  (`terms[1].name is required`) from a malformed one
  (`terms[1].name must be a non-empty string`). No other
  spec ambiguity was found in the core behaviour.
- Container build not exercised locally; the
  publish-container workflow smoke-tests the image at
  publish time.
- Nothing pushed or published; this is a local build only.
