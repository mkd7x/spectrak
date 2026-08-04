# Recommended Improvements

## 1. Immutable Revisions

Current behavior updates content in place under the same UUID. This makes historical source commits resolve to the latest content rather than the content that existed when the code was written.

Recommended behavior:

- Keep a stable logical UUID for the spec.
- Assign a monotonically increasing revision to each update.
- Support retrieval of the latest revision and a pinned revision.
- Allow references such as `spec://UUID@revision` for release and compliance artifacts.
- Preserve prior content instead of overwriting it permanently.

This is the highest-priority enterprise improvement because traceability without historical versioning is not reproducible.

## 2. Reference Integrity Validation

Add a validation command or API operation that accepts project files or extracted UUIDs and reports:

- Missing UUIDs.
- Invalid UUID formats.
- Duplicate or conflicting references.
- References present in source but absent from feature indexes.
- Index references that do not resolve.

The consuming project should be able to run this check in CI before merging changes.

## 3. Batch Retrieval

Add a batch endpoint such as:

```http
POST /api/specs/batch
```

with:

```json
{
  "uuids": ["uuid-1", "uuid-2"]
}
```

The response should preserve requested identifiers, return found records, and identify missing records explicitly. This avoids one HTTP request per source marker when an agent needs several independent chunks.

## 4. Search And Discovery

UUIDs are efficient once known, but agents often begin with a concept rather than an identifier. Add a read-only search endpoint supporting:

- Title search.
- Full-text content search.
- Project or namespace filtering.
- Tags or domains.
- Status and revision filtering.

Search results should return compact metadata first. Agents should fetch full content only for selected records.

## 5. Optimistic Concurrency

The current upsert behavior is last-write-wins. Add a revision or ETag precondition so an update can state which version it was based on. Reject stale updates rather than silently overwriting another agent's work.

## 6. Export And Offline Snapshots

Provide a command or endpoint to export selected specs and their revisions into a versioned local snapshot. This supports:

- Offline agent work.
- Reproducible releases.
- Code review of documentation changes.
- Recovery when the service is unavailable.

The snapshot should retain UUIDs and revisions so source markers remain meaningful.

## 7. Enterprise Access Controls

Before exposing Spectrak beyond a trusted local environment, add:

- Authentication.
- Project and tenant isolation.
- Read/write permissions.
- Audit logging.
- Rate limiting.
- Encrypted transport.

The current local service intentionally has none of these controls.

## 8. Related-Spec Relationships

Add optional relationships such as `relatedSpecs`, `dependsOn`, or `supersedes`. This helps agents discover adjacent constraints without loading an entire documentation tree.

Relationships should be explicit and queryable rather than inferred only from prose.

## 9. Operational Health And Metrics

Add a health endpoint separate from `/api/help`, for example `GET /health`, and expose operational metrics such as:

- Request latency.
- Retrieval counts.
- Missing-reference counts.
- Update conflicts.
- Database size.
- Migration status.

Keep `/api/help` focused on capability discovery.
