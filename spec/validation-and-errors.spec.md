# Validation And Errors

Spec ID: `SPK-ERROR-001`

## Contract

Incoming UUIDs are validated as UUID v4 values with Zod before database execution. JSON request bodies are parsed explicitly and malformed JSON is reported separately.

JSON request bodies are limited to 1 MiB. Oversized requests return HTTP 413 with `ERR_PAYLOAD_TOO_LARGE` before route parsing.

Validation failures return HTTP 400 with `ERR_VALIDATION` and structured issue details. Malformed JSON returns `ERR_INVALID_JSON`. Missing records return `ERR_SPEC_NOT_FOUND`. Unknown routes return `ERR_NOT_FOUND`. Unexpected failures return `ERR_INTERNAL`.

Every error response includes a human-readable `error` and a machine-readable `code`.
