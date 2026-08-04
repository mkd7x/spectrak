# Spectrak Agent Instructions

Use Spectrak as the canonical API-backed store for Markdown documentation and implementation context.

## Discover The API

Use the configured `SPECTRAK_URL` base URL. Before assuming endpoint details or supported syntax, query:

```sh
curl "$SPECTRAK_URL/api/help"
```

Check service and database readiness with `GET /health` before a task that depends on retrieval.

Do not access or modify `specs.db` directly from an agent task.

## Retrieval

- Extract UUIDs from relevant indexes and source-code trace comments.
- Validate that identifiers are UUID v4 values.
- Deduplicate UUIDs before querying.
- Retrieve one chunk with `GET /api/specs/:uuid`.
- Use `POST /api/specs/resolve` when a Markdown index containing multiple supported references must be expanded.
- Query only the context relevant to the current task.
- Retrieve multiple independent chunks concurrently when appropriate.
- Treat a missing UUID as missing context; do not invent replacement content.

Supported expandable Markdown references are:

```markdown
{{spec:UUID}}
[Readable title](spec://UUID)
```

Source-code traceability uses a direct lookup marker:

```ts
// spec: UUID
```

Source comments and bare UUIDs are locators only. Extract the UUID and use `GET /api/specs/:uuid`; do not send source code through the Markdown resolver.

Do not write resolved Markdown back into compact index files. Resolved content is temporary task context.

## Storage And Updates

- Generate a UUID v4 for new context.
- Use `POST /api/specs` to create a chunk.
- Preserve the UUID when updating an existing chunk.
- Use the response status to distinguish creation (`201`) from update (`200`).
- Keep titles useful for routing and orientation.
- Keep independently retrievable context in separate chunks when that avoids unnecessary context retrieval.
- Put the returned UUID in the relevant index or source traceability marker.
- Verify the returned UUID after writes.

The UUID is the stable identity. Do not create a replacement UUID merely because Markdown content changed.

## Traceability

Before changing code with a `spec: UUID` comment:

1. Retrieve the referenced spec.
2. Compare its constraints with the planned change.
3. Preserve or update the traceability comment as appropriate.
4. Report missing or stale references instead of silently ignoring them.

## Maintenance And Deletion

- Scan relevant indexes and source files before deleting a chunk.
- Remember that deletion leaves references intact and can create missing-spec callouts.
- Do not claim that all references were audited unless the relevant project files were actually scanned.
- The API currently has no list or orphan-detection endpoint.

Deletion is performed through `DELETE /api/specs/:uuid` and is idempotent.

## Errors

- `ERR_VALIDATION`: correct the UUID or payload before retrying.
- `ERR_PAYLOAD_TOO_LARGE`: reduce the request body before retrying.
- `ERR_INVALID_JSON`: correct request serialization before retrying.
- `ERR_SPEC_NOT_FOUND`: report or repair the missing reference; do not invent content.
- `ERR_NOT_FOUND`: confirm the endpoint path from `/api/help`.
- `ERR_INTERNAL`: treat as a service failure and retry only when appropriate.

Do not retry validation or missing-spec errors unchanged.
