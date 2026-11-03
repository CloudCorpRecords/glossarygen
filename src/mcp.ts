/**
 * glossarygen MCP server. Tools: build_glossary.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys
 * not in this tool's defined spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schema as an explicit literal, and every
 * tools/call is validated by the core, which names the
 * offending path on invalid input.
 *
 * The computation is pure and local: no filesystem, no
 * network, and no configuration — the caller supplies every
 * term fact the glossary is built from, and nothing is
 * defined or fetched by the tool.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { buildGlossary, formatPayload, VERSION } from "./glossarygen.js";

const TOOLS = [
  {
    name: "build_glossary",
    description:
      "Build a project glossary from caller-supplied terms: identifier and doc names are normalized and merged, each entry carrying its sources and its supplied definition, if any. Nothing is defined or fetched by the tool.",
    inputSchema: {
      type: "object" as const,
      properties: {
        terms: {
          type: "array",
          description: "Term occurrences to merge, in the caller's order",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Term as found: an identifier or a doc phrase",
              },
              source: {
                type: "string",
                description:
                  "Where the term was found (a path or link), echoed as the entry's source",
              },
              definition: {
                type: "string",
                description: "A definition found in the docs (optional)",
              },
            },
            required: ["name", "source"],
          },
        },
      },
      required: ["terms"],
    },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "glossarygen", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let out: unknown;
    if (name === "build_glossary") {
      out = buildGlossary(args ?? {});
    } else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
