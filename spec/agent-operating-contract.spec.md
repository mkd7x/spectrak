# Agent Operating Contract

Spec ID: `SPK-AGENT-001`

## Contract

Agents use compact, version-controlled indexes and source-code UUID markers to select relevant context. They retrieve only the needed chunks, deduplicate UUIDs, preserve identifiers during updates, and never write directly to SQLite.

Resolved Markdown is temporary task context and should not be written back into compact indexes. Missing specs are reported as missing context rather than replaced with guesses.

Source-code markers should be placed near the behavior they describe so a lookup provides precise context instead of an entire unrelated file's requirements.
