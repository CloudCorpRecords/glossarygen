import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildGlossary, normalizeTermKey } from "../src/glossarygen.js";

/**
 * All tests are pure local computation over inline term
 * facts: no filesystem, no network. Every worked example
 * from the spec, the camel / acronym boundary rules in both
 * directions, the user_id / UserID merge, source dedupe
 * and code-unit sorting, first-definition-wins including
 * the empty-string definition, display capitalization,
 * entry ordering and counts, the empty-key error, and every
 * validation path are each pinned.
 */

type T = Record<string, unknown>;

const term = (over: T = {}): T => ({
  name: "user_id",
  source: "src/user.ts",
  ...over,
});

const build = (terms: unknown) => buildGlossary({ terms });

const one = (over: T = {}) => build([term(over)]).entries[0];

describe("normalizeTermKey — the five worked examples from the spec", () => {
  it("parseHTTPResponse -> parse http response", () => {
    assert.equal(normalizeTermKey("parseHTTPResponse"), "parse http response");
  });

  it("HTTPServer -> http server", () => {
    assert.equal(normalizeTermKey("HTTPServer"), "http server");
  });

  it("user_id -> user id", () => {
    assert.equal(normalizeTermKey("user_id"), "user id");
  });

  it("UserID -> user id", () => {
    assert.equal(normalizeTermKey("UserID"), "user id");
  });

  it("already spaced -> already spaced", () => {
    assert.equal(normalizeTermKey("already spaced"), "already spaced");
  });
});

describe("normalizeTermKey — separator runs and whitespace", () => {
  it("a run of underscores collapses to a single space", () => {
    assert.equal(normalizeTermKey("user___id"), "user id");
  });

  it("hyphens are separators, and a mixed run collapses to one space", () => {
    assert.equal(normalizeTermKey("content-type"), "content type");
    assert.equal(normalizeTermKey("a_-__-b"), "a b");
  });

  it("leading and trailing separators drop away", () => {
    assert.equal(normalizeTermKey("__user_id__"), "user id");
    assert.equal(normalizeTermKey("-wrapped-"), "wrapped");
  });

  it("whitespace runs collapse and are trimmed", () => {
    assert.equal(normalizeTermKey("  some   spaced\tphrase  "), "some spaced phrase");
  });

  it("separators alone produce the empty key", () => {
    assert.equal(normalizeTermKey("___"), "");
    assert.equal(normalizeTermKey("---"), "");
    assert.equal(normalizeTermKey("_-_"), "");
  });
});

describe("normalizeTermKey — camel humps and the acronym boundary", () => {
  it("lowercase-to-uppercase splits (the plain camel hump)", () => {
    assert.equal(normalizeTermKey("camelCaseName"), "camel case name");
  });

  it("digit-to-uppercase splits", () => {
    assert.equal(normalizeTermKey("sha256Hash"), "sha256 hash");
    assert.equal(normalizeTermKey("v2API"), "v2 api");
  });

  it("acronym boundary: an uppercase run hands off to a capitalized word", () => {
    // Uppercase preceded by uppercase and followed by lowercase splits.
    assert.equal(normalizeTermKey("HTTPServer"), "http server");
    assert.equal(normalizeTermKey("JSONData"), "json data");
    assert.equal(normalizeTermKey("ABCd"), "ab cd");
  });

  it("acronym non-boundary: an uppercase run at the end does not split internally", () => {
    assert.equal(normalizeTermKey("userID"), "user id");
    assert.equal(normalizeTermKey("HTTPS"), "https");
    assert.equal(normalizeTermKey("parseXML"), "parse xml");
  });

  it("a leading acronym followed by a camel word splits once at the boundary", () => {
    assert.equal(normalizeTermKey("XMLHttpRequest"), "xml http request");
  });

  it("a single uppercase letter is one word, lowercased", () => {
    assert.equal(normalizeTermKey("A"), "a");
    assert.equal(normalizeTermKey("Zebra"), "zebra");
  });

  it("digits inside a word stay attached when no hump follows", () => {
    assert.equal(normalizeTermKey("utf8"), "utf8");
    assert.equal(normalizeTermKey("base64Encode"), "base64 encode");
  });
});

describe("buildGlossary — merging", () => {
  it("user_id and UserID merge into one entry (spec example)", () => {
    const out = build([
      term({ name: "user_id", source: "src/user.ts" }),
      term({ name: "UserID", source: "docs/glossary.md" }),
    ]);
    assert.deepEqual(out.entries, [
      {
        term: "User id",
        sources: ["docs/glossary.md", "src/user.ts"],
        occurrences: 2,
        definition: null,
      },
    ]);
    assert.deepEqual(out.counts, {
      supplied: 2,
      distinct_terms: 1,
      with_definition: 0,
      without_definition: 1,
    });
  });

  it("spellings that normalize identically merge whatever their case or separators", () => {
    const out = build([
      term({ name: "content-type", source: "a" }),
      term({ name: "contentType", source: "b" }),
      term({ name: "Content Type", source: "c" }),
      term({ name: "CONTENT_TYPE", source: "d" }),
    ]);
    assert.equal(out.entries.length, 1);
    assert.equal(out.entries[0].term, "Content type");
    assert.equal(out.entries[0].occurrences, 4);
    assert.deepEqual(out.entries[0].sources, ["a", "b", "c", "d"]);
  });

  it("distinct keys stay distinct entries", () => {
    const out = build([
      term({ name: "user_id", source: "a" }),
      term({ name: "user_name", source: "b" }),
    ]);
    assert.equal(out.counts.distinct_terms, 2);
    assert.equal(out.counts.supplied, 2);
  });

  it("occurrences counts every merged occurrence", () => {
    const out = build([
      term({ source: "a" }),
      term({ source: "b" }),
      term({ name: "UserId", source: "c" }),
    ]);
    assert.equal(out.entries[0].occurrences, 3);
  });
});

describe("buildGlossary — sources", () => {
  it("duplicate sources are deduped within a merged entry", () => {
    const out = build([
      term({ source: "src/user.ts" }),
      term({ name: "UserID", source: "src/user.ts" }),
      term({ name: "USER_ID", source: "src/user.ts" }),
    ]);
    assert.deepEqual(out.entries[0].sources, ["src/user.ts"]);
    assert.equal(out.entries[0].occurrences, 3);
  });

  it("sources are sorted code-unit ascending regardless of input order", () => {
    const out = build([
      term({ source: "src/z.ts" }),
      term({ name: "UserID", source: "Docs/a.md" }),
      term({ name: "user-id", source: "src/a.ts" }),
      term({ name: "userId", source: "docs/b.md" }),
    ]);
    // Code-unit ascending: uppercase letters sort before lowercase.
    assert.deepEqual(out.entries[0].sources, [
      "Docs/a.md",
      "docs/b.md",
      "src/a.ts",
      "src/z.ts",
    ]);
  });

  it("a source echoes verbatim, never normalized", () => {
    const out = one({ source: "Docs/Some File.md#User_ID" });
    assert.deepEqual(out.sources, ["Docs/Some File.md#User_ID"]);
  });
});

describe("buildGlossary — definitions", () => {
  it("the first supplied definition in input order wins", () => {
    const out = build([
      term({ source: "a" }),
      term({ name: "UserID", source: "b", definition: "the second occurrence defines it" }),
      term({ name: "userId", source: "c", definition: "a later definition loses" }),
    ]);
    assert.equal(out.entries[0].definition, "the second occurrence defines it");
  });

  it("an empty-string definition counts as supplied and echoes verbatim", () => {
    const out = build([
      term({ source: "a", definition: "" }),
      term({ name: "UserID", source: "b", definition: "real words lose to the earlier empty string" }),
    ]);
    assert.equal(out.entries[0].definition, "");
    assert.equal(out.counts.with_definition, 1);
    assert.equal(out.counts.without_definition, 0);
  });

  it("a definition echoes verbatim, whitespace and case included", () => {
    const out = one({ definition: "  A User, exactly as written.  " });
    assert.equal(out.definition, "  A User, exactly as written.  ");
  });

  it("no definition anywhere gives null", () => {
    assert.equal(one({}).definition, null);
    const out = build([term({ source: "a" }), term({ name: "UserID", source: "b" })]);
    assert.equal(out.entries[0].definition, null);
  });
});

describe("buildGlossary — display form, ordering, and counts", () => {
  it("display form is the key with its first character uppercased only", () => {
    assert.equal(one({ name: "parseHTTPResponse" }).term, "Parse http response");
    assert.equal(one({ name: "HTTPServer" }).term, "Http server");
    assert.equal(one({ name: "already spaced" }).term, "Already spaced");
  });

  it("entries are sorted by key code-unit ascending, not input order", () => {
    const out = build([
      term({ name: "zebra", source: "a" }),
      term({ name: "apple_pie", source: "b" }),
      term({ name: "Mango", source: "c" }),
      term({ name: "apple", source: "d" }),
    ]);
    assert.deepEqual(
      out.entries.map((e) => e.term),
      ["Apple", "Apple pie", "Mango", "Zebra"],
    );
  });

  it("entry keys are in the pinned order term, sources, occurrences, definition", () => {
    assert.deepEqual(Object.keys(one({})), [
      "term",
      "sources",
      "occurrences",
      "definition",
    ]);
  });

  it("counts keys are in the pinned order supplied, distinct_terms, with_definition, without_definition", () => {
    const out = build([term({})]);
    assert.deepEqual(Object.keys(out.counts), [
      "supplied",
      "distinct_terms",
      "with_definition",
      "without_definition",
    ]);
    assert.deepEqual(Object.keys(out), ["entries", "counts"]);
  });

  it("counts tally supplied, distinct, and the definition split", () => {
    const out = build([
      term({ name: "user_id", source: "a", definition: "a user" }),
      term({ name: "UserID", source: "b" }),
      term({ name: "api_key", source: "c" }),
      term({ name: "apiKey", source: "d", definition: "" }),
      term({ name: "orphan", source: "e" }),
    ]);
    assert.deepEqual(out.counts, {
      supplied: 5,
      distinct_terms: 3,
      with_definition: 2,
      without_definition: 1,
    });
  });

  it("a single term with a definition gives with_definition 1 and without_definition 0", () => {
    const out = build([term({ definition: "the user" })]);
    assert.deepEqual(out.entries, [
      {
        term: "User id",
        sources: ["src/user.ts"],
        occurrences: 1,
        definition: "the user",
      },
    ]);
    assert.deepEqual(out.counts, {
      supplied: 1,
      distinct_terms: 1,
      with_definition: 1,
      without_definition: 0,
    });
  });
});

describe("buildGlossary — empty-key names", () => {
  const throws = (args: unknown, message: string) =>
    assert.throws(() => buildGlossary(args), { message });

  it("a name of only separators is an error naming its path (spec example shape)", () => {
    throws(
      { terms: [term({}), term({ name: "___", source: "x" })] },
      "terms[1].name produces an empty term",
    );
  });

  it("hyphen-only and separator-and-space-only names are empty-key errors", () => {
    throws({ terms: [term({ name: "---" })] }, "terms[0].name produces an empty term");
    throws({ terms: [term({ name: "_- _-" })] }, "terms[0].name produces an empty term");
    throws({ terms: [term({ name: "   " })] }, "terms[0].name produces an empty term");
  });

  it("no partial result is produced when a later term has an empty key", () => {
    assert.throws(() =>
      build([term({ name: "fine", source: "a" }), term({ name: "___", source: "b" })]),
    );
  });
});

describe("buildGlossary — validation", () => {
  const throws = (args: unknown, message: string) =>
    assert.throws(() => buildGlossary(args), { message });

  it("terms missing is an error naming terms", () => {
    throws({}, "terms is required");
  });

  it("a non-object top-level argument is treated as {} and fails on terms", () => {
    throws(null, "terms is required");
    throws([], "terms is required");
    throws("x", "terms is required");
    throws(42, "terms is required");
    throws(undefined, "terms is required");
  });

  it("terms not an array or empty names terms", () => {
    throws({ terms: "x" }, "terms must be a non-empty array");
    throws({ terms: {} }, "terms must be a non-empty array");
    throws({ terms: 3 }, "terms must be a non-empty array");
    throws({ terms: null }, "terms must be a non-empty array");
    throws({ terms: [] }, "terms must be a non-empty array");
  });

  it("an item that is not an object names its index", () => {
    throws({ terms: ["x"] }, "terms[0] must be an object");
    throws({ terms: [null] }, "terms[0] must be an object");
    throws({ terms: [[]] }, "terms[0] must be an object");
    throws({ terms: [term({}), 7] }, "terms[1] must be an object");
  });

  it("name missing names terms[i].name as required", () => {
    const { name: _n, ...noName } = term();
    throws({ terms: [noName] }, "terms[0].name is required");
    throws(
      { terms: [term({}), noName] },
      "terms[1].name is required",
    );
  });

  it("name empty or non-string names terms[i].name", () => {
    throws({ terms: [term({ name: "" })] }, "terms[0].name must be a non-empty string");
    for (const bad of [42, true, null, [], {}]) {
      throws({ terms: [term({ name: bad })] }, "terms[0].name must be a non-empty string");
    }
  });

  it("source missing names terms[i].source as required", () => {
    const { source: _s, ...noSource } = term();
    throws({ terms: [noSource] }, "terms[0].source is required");
  });

  it("source empty or non-string names terms[i].source", () => {
    throws(
      { terms: [term({ source: "" })] },
      "terms[0].source must be a non-empty string",
    );
    for (const bad of [42, true, null, [], {}]) {
      throws(
        { terms: [term({}), term({ source: bad })] },
        "terms[1].source must be a non-empty string",
      );
    }
  });

  it("definition present but not a string names terms[i].definition", () => {
    for (const bad of [42, true, null, [], {}]) {
      throws(
        { terms: [term({ definition: bad })] },
        "terms[0].definition must be a string",
      );
    }
  });

  it("unknown extra fields are ignored, including inside items", () => {
    const out = buildGlossary({
      terms: [term({ found_by: "grep", line: 12 })],
      generated_by: "test",
    });
    assert.equal(out.entries[0].term, "User id");
    assert.equal(out.counts.supplied, 1);
  });

  it("no partial result is produced on invalid input deep in the list", () => {
    assert.throws(() =>
      build([
        term({ name: "fine_one", source: "a" }),
        term({ name: "fine_two", source: "b" }),
        term({ name: "bad", source: "" }),
      ]),
    );
  });
});
