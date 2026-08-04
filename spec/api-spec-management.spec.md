# API Spec Management

Spec ID: `SPK-API-001`

## Contract

Spectrak exposes HTTP operations for storing and retrieving Markdown documentation chunks.

### Retrieve

`GET /api/specs/:uuid` validates a UUID v4, retrieves one record by its primary key, and returns `uuid`, `title`, `content`, and `updatedAt`. A missing record returns `ERR_SPEC_NOT_FOUND`.

### Create Or Update

`POST /api/specs` accepts a UUID v4, optional title, and Markdown content. It creates a new record with `201 Created` or updates an existing UUID with `200 OK`. Updates preserve `created_at` and refresh `updated_at`.

### Delete

`DELETE /api/specs/:uuid` validates the UUID and performs an idempotent deletion. It returns a success response whether or not the record existed.

All database operations are performed through Drizzle ORM rather than direct route-level SQL.
