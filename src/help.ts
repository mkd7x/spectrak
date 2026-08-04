// spec: SPK-HELP-001
export const helpDocument = {
  service: "spectrak",
  version: "0.1.0",
  basePath: "/api",
  endpoints: [
    {
      method: "GET",
      path: "/api/help",
      purpose: "Discover Spectrak capabilities and supported reference syntax",
    },
    {
      method: "GET",
      path: "/api/specs/:uuid",
      purpose: "Retrieve one Markdown spec chunk",
      response: "{ uuid, title, content, updatedAt }",
    },
    {
      method: "POST",
      path: "/api/specs",
      purpose: "Create or update a Markdown spec chunk",
      request: "{ uuid, title?, content }",
      responses: [201, 200],
    },
    {
      method: "DELETE",
      path: "/api/specs/:uuid",
      purpose: "Delete a spec chunk; the operation is idempotent",
      response: "{ success, message }",
    },
    {
      method: "POST",
      path: "/api/specs/resolve",
      purpose: "Expand supported spec references in Markdown",
      request: "{ content }",
      response: "{ resolvedContent }",
    },
  ],
  referenceSyntax: {
    expandable: [
      {
        syntax: "{{spec:UUID}}",
        purpose: "Compact Markdown index reference",
      },
      {
        syntax: "[Title](spec://UUID)",
        purpose: "Readable Markdown index reference",
      },
    ],
    traceability: {
      syntax: "// spec: UUID",
      purpose: "Source-code locator for direct spec retrieval",
      resolverSupport: false,
    },
  },
  requirements: {
    uuid: "UUID v4",
    content: "Markdown string",
    timestamps: "Unix seconds",
  },
  errors: [
    "ERR_VALIDATION",
    "ERR_SPEC_NOT_FOUND",
    "ERR_INVALID_JSON",
    "ERR_NOT_FOUND",
    "ERR_INTERNAL",
  ],
} as const;
