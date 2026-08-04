# Runtime API Discovery

Spec ID: `SPK-HELP-001`

## Contract

`GET /api/help` returns a static machine-readable description of the service, endpoint paths, request and response shapes, supported reference syntax, UUID requirements, and error codes.

The help response does not access SQLite and does not expose filesystem paths, database paths, environment variables, or secrets. Agents can use it to discover the runtime API before querying or updating specs.
