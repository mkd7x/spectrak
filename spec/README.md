# Spectrak Source Specifications

This directory contains the traditional, version-controlled specifications for the Spectrak project itself. Spectrak is not used to store or retrieve these specifications.

Each full Markdown specification has a stable project-local ID. That ID is embedded near the source code implementing the behavior.

## Index

- [API spec management](api-spec-management.spec.md): `SPK-API-001`
- [Markdown index resolution](index-resolution.spec.md): `SPK-RESOLVE-001`
- [Database persistence](persistence.spec.md): `SPK-DB-001`
- [Validation and error handling](validation-and-errors.spec.md): `SPK-ERROR-001`
- [Runtime API discovery](runtime-discovery.spec.md): `SPK-HELP-001`
- [Agent operating contract](agent-operating-contract.spec.md): `SPK-AGENT-001`

## Traceability Convention

Place `// spec: SPK-...` immediately before the function, route group, schema, or constant that implements the referenced behavior. Use the language's equivalent comment syntax when necessary, but preserve the `spec: ID` marker format.

Do not attach a large set of unrelated UUIDs to the top of an entire file when a narrower code location is available.
