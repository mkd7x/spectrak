# Recommended Operating Model

## Division Of Responsibility

Use Git and Spectrak for different responsibilities:

- Git stores application code, compact feature indexes, source-code UUID markers, and project instructions.
- Spectrak stores detailed, reusable Markdown context.
- Git commits provide implementation history.
- Spec revisions provide documentation history.
- CI validates that referenced UUIDs exist.
- Release artifacts pin the exact spec revisions used by a release.

Spectrak should not be the only durable record for compliance-critical requirements until revisioning and export are available.

## Agent Retrieval Loop

1. Discover the running API through `/api/help`.
2. Identify the feature index or source-code trace marker relevant to the task.
3. Extract and deduplicate UUIDs.
4. Retrieve only the selected chunks.
5. Re-fetch context when conversation compaction or a new task makes prior context uncertain.
6. Implement against the retrieved acceptance criteria.
7. Preserve or update the nearby source-code marker.
8. Validate all changed references before finishing.

Resolved Markdown is temporary agent context. Do not write expanded content back into compact indexes.

## Chunking Rules

- Keep each chunk cohesive and independently understandable.
- Store acceptance criteria, constraints, decisions, and invariants rather than broad narrative.
- Use titles and index labels as routing metadata.
- Keep related but independently retrievable behavior in separate chunks.
- Add explicit relationships when one chunk depends on another.

## Transient Context Risks

The SQLite records are persistent. The expanded Markdown loaded into an agent context is transient by design. The main risk is not database data loss; it is that an agent forgets or never retrieves a relevant chunk.

Mitigations:

- Keep UUIDs in version-controlled indexes and source comments.
- Require agents to re-fetch context rather than rely on memory.
- Add reference integrity checks to CI.
- Provide batch and search APIs for efficient retrieval.
- Export pinned snapshots for releases and offline work.
- Add immutable revisions so historical code can be explained with historical requirements.

## Enterprise Requirements

Before shared or compliance-sensitive use, add:

- Authentication and authorization.
- Project and tenant isolation.
- Audit logging.
- Revision history and optimistic concurrency.
- Search, batch retrieval, and reference validation.
- Backups, migrations, and recovery procedures.
- Health monitoring and request metrics.

## Current Experiment Assessment

The Todo experiment demonstrates the core value of compact indexes and UUID-based retrieval. It does not yet demonstrate historical reproducibility, automated integrity enforcement, shared-service security, or failure recovery. Those should be treated as the next evaluation stages rather than assumed capabilities.
