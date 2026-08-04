# Database Persistence

Spec ID: `SPK-DB-001`

## Contract

The service uses SQLite and Drizzle ORM. On startup it opens `specs.db` or the path supplied by `SPEC_DB_PATH`, enables SQLite runtime pragmas, and applies migrations before serving requests.

The `specs` table contains:

- `uuid` text primary key.
- Nullable `title` text.
- Required Markdown `content` text.
- Integer Unix-second `created_at`.
- Integer Unix-second `updated_at`.

The UUID primary key supports direct indexed retrieval. The application closes the SQLite handle during SIGINT and SIGTERM shutdown.
