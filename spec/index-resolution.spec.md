# Markdown Index Resolution

Spec ID: `SPK-RESOLVE-001`

## Contract

`POST /api/specs/resolve` accepts `{ "content": "..." }` and expands supported spec references in the supplied Markdown.

Supported references:

```markdown
{{spec:UUID}}
[Title](spec://UUID)
```

The resolver extracts unique UUIDs, batch-queries SQLite, and replaces each reference with raw stored Markdown. Duplicate references are expanded consistently. A missing UUID becomes an inline callout instead of failing the request.

Source-code markers such as `// spec: UUID` are direct lookup metadata and are intentionally not expanded by this Markdown resolver.
