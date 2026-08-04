import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { createDatabase } from "../src/db/client.js";

describe("spec API", () => {
  let directory: string;
  let database: ReturnType<typeof createDatabase>;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "spectrak-"));
    database = createDatabase(join(directory, "test.db"));
    app = createApp(database.db);
  });

  afterEach(async () => {
    database.sqlite.close();
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
        expect.objectContaining({ method: "GET", path: "/api/specs/:uuid" }),
        expect.objectContaining({ method: "POST", path: "/api/specs" }),
        expect.objectContaining({ method: "POST", path: "/api/specs/resolve" }),
      ]),
    );
  });

  it("creates, retrieves, updates, and deletes a spec", async () => {
    const uuid = randomUUID();
    const createResponse = await app.request("/api/specs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ uuid, title: "Introduction", content: "# Hello" }),
    });

    expect(createResponse.status).toBe(201);
    expect(await createResponse.json()).toEqual({ success: true, uuid });

    const getResponse = await app.request(`/api/specs/${uuid}`);
    expect(getResponse.status).toBe(200);
    expect(await getResponse.json()).toMatchObject({
      uuid,
      title: "Introduction",
      content: "# Hello",
    });

    const updateResponse = await app.request("/api/specs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ uuid, content: "# Updated" }),
    });

    expect(updateResponse.status).toBe(200);
    expect(await updateResponse.json()).toEqual({ success: true, uuid });

    const updatedSpec = await (await app.request(`/api/specs/${uuid}`)).json();
    expect(updatedSpec).toMatchObject({ uuid, title: null, content: "# Updated" });

    const deleteResponse = await app.request(`/api/specs/${uuid}`, { method: "DELETE" });
    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ success: true, message: "Spec deleted" });
    expect((await app.request(`/api/specs/${uuid}`)).status).toBe(404);
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

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "spectrak-"));
    database = createDatabase(join(directory, "test.db"));
    app = createApp(database.db);
  });

  afterEach(async () => {
    database.sqlite.close();
    await rm(directory, { recursive: true, force: true });
  });

  it("expands both reference syntaxes, including duplicate references", async () => {
    const firstUuid = randomUUID();
    const secondUuid = randomUUID();

    for (const [uuid, content] of [
      [firstUuid, "## First"],
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
