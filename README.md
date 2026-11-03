# glossarygen

A project accumulates names faster than it accumulates
explanations for them: the same concept shows up as
`user_id` in the database layer, `UserID` in an API type,
and "user id" in the docs, and nobody can say whether
those are one term or three. glossarygen settles that
kind of question from facts you already have. You supply
term occurrences — each name exactly as you found it,
where you found it, and a definition when the docs carry
one — and glossarygen hands back a single merged
glossary: one entry per distinct term, with every source
the term was seen in and the definition the docs gave
it, if any. It writes no definitions of its own and
fetches nothing; it only normalizes and merges what you
supplied.

Normalization follows a fixed recipe, in order. First,
every run of underscores or hyphens becomes a single
space. Then camel humps are split: a space goes before an
uppercase letter that follows a lowercase letter or a
digit, and before an uppercase letter that ends an
acronym run and starts a capitalized word, so
`HTTPServer` becomes `HTTP Server`. The result is split
on whitespace and every word is lowercased; the words
joined with single spaces form the term's key. That is
why `parseHTTPResponse` keys as `parse http response`,
and why `user_id` and `UserID` land on the same key,
`user id`, and merge into one entry.

Each entry shows its term in display form — the key with
its first character uppercased, so `parse http response`
reads as `Parse http response` — together with the
distinct sources across all its occurrences, sorted
ascending, and how many occurrences merged into it. The
entry's definition is the first one supplied in your
order among the merged occurrences; an empty-string
definition still counts as supplied and is kept exactly
as given, and when no occurrence supplies one the
definition is `null`. Entries come back sorted by key,
and the counts report how many occurrences you supplied,
how many distinct terms they merged into, and how many
of those terms carry a definition versus not.

A name made only of separators, like `___`, normalizes
to no words at all and is a validation error naming its
path, as are a missing or empty term list, a non-object
occurrence, a missing, empty, or non-string `name` or
`source`, and a `definition` that is present but not a
string. Invalid input produces no partial glossary.
Unknown extra fields are ignored.

## CLI

```bash
npx @reneturcios/glossarygen build --input args.json
npx @reneturcios/glossarygen --version
```

`args.json` contains the full arguments object:

```json
{
  "terms": [
    {
      "name": "user_id",
      "source": "src/user.ts"
    },
    {
      "name": "UserID",
      "source": "docs/api.md",
      "definition": "Stable identifier for a user account."
    },
    {
      "name": "parseHTTPResponse",
      "source": "src/http.ts"
    }
  ]
}
```

The glossary is printed as JSON:

```json
{
  "entries": [
    {
      "term": "Parse http response",
      "sources": ["src/http.ts"],
      "occurrences": 1,
      "definition": null
    },
    {
      "term": "User id",
      "sources": ["docs/api.md", "src/user.ts"],
      "occurrences": 2,
      "definition": "Stable identifier for a user account."
    }
  ],
  "counts": {
    "supplied": 3,
    "distinct_terms": 2,
    "with_definition": 1,
    "without_definition": 1
  }
}
```

Exit codes: `0` on success, `1` on a runtime error
(including an unreadable or invalid input file, or
invalid input), `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/glossarygen mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "glossarygen": {
      "command": "npx",
      "args": ["-y", "@reneturcios/glossarygen", "mcp"]
    }
  }
}
```

### Tools

- `build_glossary` — Build a project glossary from
  caller-supplied terms: identifier and doc names are
  normalized and merged, each entry carrying its sources
  and its supplied definition, if any.
  - `terms` (array, required, at least 1 item) — the
    term occurrences to merge, in the caller's order;
    each item:
    - `name` (string, required, non-empty) — term as
      found: an identifier or a doc phrase
    - `source` (string, required, non-empty) — where
      the term was found (a path or link), echoed as
      the entry's source
    - `definition` (string, optional) — a definition
      found in the docs

  Returns `{entries, counts}`, where `entries` holds one
  `{term, sources, occurrences, definition}` per
  distinct normalized term, sorted by term key, and
  `counts` is `{supplied, distinct_terms,
  with_definition, without_definition}`.

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/glossarygen
docker run --rm -v "$PWD:/w" ghcr.io/cloudcorprecords/glossarygen build --input /w/args.json
```

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # tsx --test test/*.test.ts (pure local, no network)
npm run dev     # run the CLI from source
```

## License

MIT — Copyright (c) 2026 Rene Turcios
