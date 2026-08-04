# spectrak

Lightweight TypeScript and SQLite API for storing Markdown documentation chunks and expanding UUID references in a master index document.

## Requirements

- Node.js 22 or newer
- npm

## Development

```sh
npm install
npm run dev
```

The API listens on `http://localhost:3000` by default. Set `PORT` to use a different port. SQLite uses `./specs.db` by default; set `SPEC_DB_PATH` to override it.

Database migrations are applied automatically when the application starts.

## Agent Resources

Runtime API discovery is available at `GET /api/help`.

The detailed agent operations guide is in `docs/spectrak-agent-operations.md`. A copyable instruction pack for consuming projects is in `agent-instructions/`; it contains `AGENTS.md` and GitHub Copilot instructions.

## Commands

```sh
npm run dev          # Start the development server with reloads
npm run build        # Compile TypeScript to dist/
npm start            # Run the compiled server
npm test             # Run the test suite
npm run check        # Type-check the source
npm run db:generate  # Generate a Drizzle migration
npm run db:migrate   # Apply migrations manually
```

## API

### Discover API capabilities

`GET /api/help`

Returns a static JSON document describing available endpoints, reference syntax, UUID requirements, and error codes. Agents should query this endpoint before assuming the runtime API contract.

### Create or update a spec

`POST /api/specs`

Request body:

```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Introduction",
  "content": "# Introduction\n\nMarkdown content."
}
```

The UUID must be a UUID v4. A new record returns `201 Created`; an existing record is updated and returns `200 OK`.

### Retrieve a spec

`GET /api/specs/:uuid`

Successful response:

```json
{
  "uuid": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Introduction",
  "content": "# Introduction\n\nMarkdown content.",
  "updatedAt": 1700000000
}
```

### Delete a spec

`DELETE /api/specs/:uuid`

Deletion is idempotent. The response is:

```json
{
  "success": true,
  "message": "Spec deleted"
}
```

### Resolve an index document

`POST /api/specs/resolve`

Request body:

```json
{
  "content": "# Index\n\n{{spec:550e8400-e29b-41d4-a716-446655440000}}"
}
```

Both of these reference formats are supported:

```markdown
{{spec:550e8400-e29b-41d4-a716-446655440000}}
[Introduction](spec://550e8400-e29b-41d4-a716-446655440000)
```

Each reference is replaced with the stored raw Markdown content. Missing references are replaced with an inline callout instead of failing the request:

```markdown
> ⚠️ [Spec missing for UUID: 550e8400-e29b-41d4-a716-446655440000]
```

Successful response:

```json
{
  "resolvedContent": "# Index\n\n# Introduction"
}
```

### Errors

Errors use a consistent JSON shape:

```json
{
  "error": "Spec chunk not found",
  "code": "ERR_SPEC_NOT_FOUND"
}
```

Validation errors also include a `details` array containing Zod issue information.
