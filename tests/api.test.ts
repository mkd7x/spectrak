import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { MAX_REQUEST_BODY_BYTES } from "../src/constants.js";
import { createDatabase } from "../src/db/client.js";
import { specs } from "../src/db/schema.js";

describe("spec API", () => {
  let directory: string;
  let database: ReturnType<typeof createDatabase>;
  let app: ReturnType<typeof createApp>;
  let databaseClosed: boolean;
  let logs: string[];

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "spectrak-"));
    database = createDatabase(join(directory, "test.db"));
    databaseClosed = false;
    logs = [];
    app = createApp(database.db, { logger: (message) => logs.push(message) });
  });

  afterEach(async () => {
    if (!databaseClosed) {
      database.sqlite.close();
    }
    await rm(directory, { recursive: true, force: true });
  });

  it("exposes a machine-readable help document", async () => {
    const response = await app.request("/api/help");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body).toMatchObject({
      service: "spectrak",
      basePath: "/api",
      referenceSyntax: {
        traceability: {
          syntax: "// spec: UUID",
          resolverSupport: false,
        },
      },
    });
    expect(body.endpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "GET", path: "/api/help" }),
        expect.objectContaining({ method: "GET", path: "/health" }),
        expect.objectContaining({ method: "GET", path: "/api/specs/:uuid" }),
        expect.objectContaining({ method: "POST", path: "/api/specs" }),
        expect.objectContaining({ method: "POST", path: "/api/specs/resolve" }),
      ]),
    );
    expect(body.requirements.maxRequestBodyBytes).toBe(MAX_REQUEST_BODY_BYTES);
    expect(logs.some((log) => log.startsWith("GET /api/help 200"))).toBe(true);
  });

  it("creates, retrieves, updates, and deletes a spec", async () => {
    const uuid = randomUUID().toUpperCase();
    const normalizedUuid = uuid.toLowerCase();
    const createResponse = await app.request("/api/specs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ uuid, title: "Introduction", content: "# Hello" }),
    });

    expect(createResponse.status).toBe(201);
    expect(await createResponse.json()).toEqual({ success: true, uuid: normalizedUuid });

    const getResponse = await app.request(`/api/specs/${uuid}`);
    expect(getResponse.status).toBe(200);
    expect(await getResponse.json()).toMatchObject({
      uuid: normalizedUuid,
      title: "Introduction",
      content: "# Hello",
    });

    const storedSpec = database.db.select().from(specs).where(eq(specs.uuid, normalizedUuid)).get();
    expect(storedSpec).toMatchObject({ uuid: normalizedUuid, title: "Introduction" });
    expect(Number.isInteger(storedSpec?.createdAt)).toBe(true);
    expect(Number.isInteger(storedSpec?.updatedAt)).toBe(true);
    expect(storedSpec?.updatedAt).toBeGreaterThanOrEqual(storedSpec?.createdAt ?? 0);

    const updateResponse = await app.request("/api/specs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ uuid, content: "# Updated" }),
    });

    expect(updateResponse.status).toBe(200);
    expect(await updateResponse.json()).toEqual({ success: true, uuid: normalizedUuid });

    const updatedSpec = await (await app.request(`/api/specs/${uuid}`)).json();
    expect(updatedSpec).toMatchObject({ uuid: normalizedUuid, title: null, content: "# Updated" });

    const deleteResponse = await app.request(`/api/specs/${uuid}`, { method: "DELETE" });
    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ success: true, message: "Spec deleted" });
    const repeatedDeleteResponse = await app.request(`/api/specs/${uuid}`, { method: "DELETE" });
    expect(repeatedDeleteResponse.status).toBe(200);
    expect(await repeatedDeleteResponse.json()).toEqual({
      success: true,
      message: "Spec deleted",
    });
    expect((await app.request(`/api/specs/${uuid}`)).status).toBe(404);
  });

  it("atomically distinguishes concurrent insert and update requests", async () => {
    const uuid = randomUUID();
    const responses = await Promise.all(
      ["# First", "# Second"].map((content) =>
        app.request("/api/specs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ uuid, content }),
        }),
      ),
    );

    expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);
    const storedSpec = database.db.select().from(specs).where(eq(specs.uuid, uuid)).get();
    expect(["# First", "# Second"]).toContain(storedSpec?.content);
  });

  it("checks database health and reports request logs", async () => {
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(logs.some((log) => log.startsWith("GET /health 200"))).toBe(true);
  });

  it("reports an unhealthy database", async () => {
    database.sqlite.close();
    databaseClosed = true;

    const response = await app.request("/health");

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "error",
      error: "Database unavailable",
      code: "ERR_HEALTHCHECK_FAILED",
    });
  });

  it("returns structured errors for invalid input and missing specs", async () => {
    const invalidResponse = await app.request("/api/specs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ uuid: "not-a-uuid", content: "# Invalid" }),
    });

    expect(invalidResponse.status).toBe(400);
    expect(await invalidResponse.json()).toMatchObject({
      error: "Request validation failed",
      code: "ERR_VALIDATION",
    });

    const missingResponse = await app.request(`/api/specs/${randomUUID()}`);
    expect(missingResponse.status).toBe(404);
    expect(await missingResponse.json()).toEqual({
      error: "Spec chunk not found",
      code: "ERR_SPEC_NOT_FOUND",
    });

    const malformedResponse = await app.request("/api/specs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    expect(malformedResponse.status).toBe(400);
    expect(await malformedResponse.json()).toEqual({
      error: "Request body must be valid JSON",
      code: "ERR_INVALID_JSON",
    });

    const oversizedResponse = await app.request("/api/specs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        uuid: randomUUID(),
        content: "x".repeat(MAX_REQUEST_BODY_BYTES),
      }),
    });

    expect(oversizedResponse.status).toBe(413);
    expect(await oversizedResponse.json()).toEqual({
      error: "Request body too large",
      code: "ERR_PAYLOAD_TOO_LARGE",
    });

    const routeNotFoundResponse = await app.request("/api/unknown");
    expect(routeNotFoundResponse.status).toBe(404);
    expect(await routeNotFoundResponse.json()).toEqual({
      error: "Route not found",
      code: "ERR_NOT_FOUND",
    });
  });
});

describe("Markdown resolver", () => {
  let directory: string;
  let database: ReturnType<typeof createDatabase>;
  let app: ReturnType<typeof createApp>;
  let databaseClosed: boolean;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "spectrak-"));
    database = createDatabase(join(directory, "test.db"));
    databaseClosed = false;
    app = createApp(database.db, { logger: () => undefined });
  });

  afterEach(async () => {
    if (!databaseClosed) {
      database.sqlite.close();
    }
    await rm(directory, { recursive: true, force: true });
  });

  it("expands both reference syntaxes, including duplicate references", async () => {
    const firstUuid = randomUUID();
    const secondUuid = randomUUID();

    for (const [uuid, content] of [
      [firstUuid, "## First $1 \\ path [brackets]"],
      [secondUuid, "## Second"],
    ]) {
      const response = await app.request("/api/specs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uuid, content }),
      });
      expect(response.status).toBe(201);
    }

    const response = await app.request("/api/specs/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: [
          "# Index",
          `{{spec:${firstUuid}}}`,
          `[A named spec](spec://${secondUuid})`,
          `{{spec:${firstUuid}}}`,
          `{{spec:${randomUUID()}}}`,
        ].join("\n\n"),
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.resolvedContent).toContain("## First");
    expect(body.resolvedContent).toContain("## First $1 \\ path [brackets]");
    expect(body.resolvedContent).toContain("## Second");
    expect(body.resolvedContent.match(/## First/g)).toHaveLength(2);
    expect(body.resolvedContent).toContain("> ⚠️ [Spec missing for UUID:");
    expect(body.resolvedContent).not.toContain("spec://");
  });

  it("leaves content without references unchanged", async () => {
    const content = "# No references\n\nNothing to expand.";
    const response = await app.request("/api/specs/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ resolvedContent: content });
  });
});
