# Spectrak Agent Operations

This guide describes how an AI agent stores, retrieves, resolves, and maintains Markdown context with Spectrak. Spectrak is an API-backed documentation store; the API and SQLite database are the source of truth for stored spec chunks.

## Operating Model

Spectrak stores independently retrievable Markdown chunks under immutable UUID v4 identifiers. Repository Markdown files can act as compact indexes by keeping a short description next to a UUID instead of embedding the full context.

Source code can also carry a UUID locator in a comment. The locator lets an agent retrieve the relevant context before changing the related implementation.

Use the API for database operations. Do not modify `specs.db` directly from an agent task.

## Discover The Service

The consuming project should expose the Spectrak base URL through its configuration. The portable instruction pack uses `SPECTRAK_URL` as the conventional variable name.

Before assuming endpoint details, query the runtime help document:

```sh
curl "$SPECTRAK_URL/api/help"
```

The help response is static and machine-readable. It lists the available endpoints, supported reference syntax, UUID requirements, and error codes.

Do not assume that `SPECTRAK_URL` points to the same host as the project being modified. The Spectrak service may be local, remote, or provided by a development environment.

## Reference Forms

Use a compact expandable reference when an index is expected to be resolved by Spectrak:

```markdown
file upload handling for local device files: {{spec:550e8400-e29b-41d4-a716-446655440000}}
```

Use a readable Markdown link when the index will be read by both agents and people:

```markdown
[SharePoint linked file handling](spec://550e8400-e29b-41d4-a716-446655440000)
```

Use a source-code comment for direct traceability:

```ts
// spec: 550e8400-e29b-41d4-a716-446655440000
```

The Markdown resolver expands the first two forms. A source-code comment is a locator only; extract its UUID and retrieve it with `GET /api/specs/:uuid`.

Bare UUIDs without one of the supported reference forms are also locator-only. They are not expanded by the resolver.

All UUIDs sent to the API must be valid UUID v4 values. Spectrak normalizes accepted UUIDs to lowercase.

## Retrieval Workflow

1. Identify the relevant index entry, source-code trace comment, or explicit UUID.
2. Extract all candidate UUIDs before making requests.
3. Remove duplicate UUIDs within the current task.
4. Retrieve only the chunks relevant to the current change.
5. Use the returned `content` as task context without modifying it accidentally.
6. Treat a missing UUID as missing context and report it rather than inventing its contents.

Retrieve one chunk directly:

```sh
curl "$SPECTRAK_URL/api/specs/550e8400-e29b-41d4-a716-446655440000"
```

When several unrelated UUIDs are needed, agents may issue direct GET requests concurrently. When an entire Markdown index needs expansion, use one resolver request instead of manually fetching and replacing each reference.

## Markdown Resolution

Send the compact Markdown index to the resolver:

```sh
curl -X POST "$SPECTRAK_URL/api/specs/resolve" \
  -H 'content-type: application/json' \
  -d '{"content":"# Index\n\n{{spec:550e8400-e29b-41d4-a716-446655440000}}"}'
```

The response contains the expanded document in `resolvedContent`.

Resolution behavior:

- Each supported reference is replaced with the stored raw Markdown content.
- Duplicate references are expanded consistently.
- The resolver batch-queries unique UUIDs.
- A missing reference becomes an inline callout:

```markdown
> ⚠️ [Spec missing for UUID: 550e8400-e29b-41d4-a716-446655440000]
```

- Resolved output is temporary task context. Do not write the expanded output back into the compact index.

## Storing New Context

Create a new context chunk with a UUID v4:

```sh
curl -X POST "$SPECTRAK_URL/api/specs" \
  -H 'content-type: application/json' \
  -d '{
    "uuid":"550e8400-e29b-41d4-a716-446655440000",
    "title":"Local device file uploads",
    "content":"# Local device file uploads\n\nDescribe the behavior, constraints, and relevant implementation context here."
  }'
```

A successful new insert returns `201 Created`:

```json
{
  "success": true,
  "uuid": "550e8400-e29b-41d4-a716-446655440000"
}
```

After creation, place the returned UUID in the relevant compact index or source-code trace comment. The UUID, not the filename or title, is the stable identity.

## Updating Context

Update an existing chunk by sending the same UUID to `POST /api/specs`:

```sh
curl -X POST "$SPECTRAK_URL/api/specs" \
  -H 'content-type: application/json' \
  -d '{
    "uuid":"550e8400-e29b-41d4-a716-446655440000",
    "title":"Local device file uploads",
    "content":"# Local device file uploads\n\nUpdated implementation context."
  }'
```

An existing UUID returns `200 OK`. The update preserves `created_at` and refreshes `updated_at`.

Preserve the UUID when the subject remains the same. Do not create a replacement UUID merely because the Markdown content changed.

## Code Traceability

Before changing code with a `spec: UUID` comment:

1. Extract the UUID from the comment.
2. Retrieve the spec directly.
3. Compare the requested change with the stored behavior and constraints.
4. Preserve or update the traceability comment as part of the implementation change.
5. If the referenced UUID is missing, report the missing context before making assumptions.

For multiple comments, collect unique UUIDs and retrieve them concurrently. Do not send source code through the Markdown resolver merely to process comments.

## Maintenance Workflow

When maintaining indexes or references:

1. Scan the relevant files for supported Markdown references and traceability comments.
2. Validate that each extracted identifier is a UUID v4.
3. Query each unique identifier.
4. Report missing records and stale references.
5. Update existing records through `POST /api/specs`.
6. Verify the response status and returned UUID.
7. Re-query changed records when the task requires confirmation.

Deletion is idempotent:

```sh
curl -X DELETE "$SPECTRAK_URL/api/specs/550e8400-e29b-41d4-a716-446655440000"
```

Before deleting a chunk, scan known indexes and source files for references. Deleting a record leaves references intact, so deletion can create missing-spec callouts later.

The current API does not provide a list or orphan-detection endpoint. Do not claim that all references have been audited unless the agent actually scanned the relevant project files.

## Error Handling

All API errors use an `error` and `code` field. Validation errors also include `details`.

| Code | Agent response |
|---|---|
| `ERR_VALIDATION` | Correct the UUID or request payload before retrying. |
| `ERR_INVALID_JSON` | Correct the request serialization before retrying. |
| `ERR_SPEC_NOT_FOUND` | Report or repair the missing reference; do not invent content. |
| `ERR_NOT_FOUND` | Confirm the endpoint path from `/api/help`. |
| `ERR_INTERNAL` | Treat as a service failure and retry only when appropriate. |

Do not retry validation or missing-spec errors unchanged.

## Context Efficiency Rules

- Query only the UUIDs relevant to the current task.
- Deduplicate UUIDs before retrieval.
- Prefer direct GET requests when one or two chunks are needed.
- Prefer one resolver request when a Markdown index must be expanded.
- Keep resolved Markdown in task context rather than persisting it into indexes.
- Use titles and compact index labels to route retrieval, not to replace the actual Markdown content.
- Keep independently retrievable context in separate UUID chunks when one large document would cause unnecessary retrieval.
- Never silently replace missing context with a guess.
