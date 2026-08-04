import { Hono } from "hono";
import { eq } from "drizzle-orm";

import type { AppDatabase } from "./db/client.js";
import { specs } from "./db/schema.js";
import { helpDocument } from "./help.js";
import { resolveMarkdown } from "./resolver.js";
import { resolvePayloadSchema, specPayloadSchema, uuidV4Schema } from "./validation.js";

type ErrorBody = {
  error: string;
  code: string;
  details?: unknown;
};

function errorResponse(
  message: string,
  code: string,
  status: 400 | 404 | 500,
  details?: unknown,
) {
  const body: ErrorBody = { error: message, code };
  if (details !== undefined) {
    body.details = details;
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function parseUuidParam(value: string) {
  const parsed = uuidV4Schema.safeParse(value);
  if (!parsed.success) {
    return {
      error: errorResponse(
        "Request validation failed",
        "ERR_VALIDATION",
        400,
        parsed.error.issues,
      ),
    };
  }

  return { uuid: parsed.data.toLowerCase() };
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new Error("ERR_INVALID_JSON");
  }
}

export function createApp(db: AppDatabase) {
  const app = new Hono();

  app.notFound((c) => c.json({ error: "Route not found", code: "ERR_NOT_FOUND" }, 404));

  app.onError((error, c) => {
    if (error.message === "ERR_INVALID_JSON") {
      return c.json({ error: "Request body must be valid JSON", code: "ERR_INVALID_JSON" }, 400);
    }

    console.error(error);
    return c.json({ error: "Internal server error", code: "ERR_INTERNAL" }, 500);
  });

  // spec: SPK-HELP-001
  app.get("/api/help", (c) => c.json(helpDocument));

  // spec: SPK-RESOLVE-001
  app.post("/api/specs/resolve", async (c) => {
    const payload = resolvePayloadSchema.safeParse(await readJson(c.req.raw));
    if (!payload.success) {
      return errorResponse(
        "Request validation failed",
        "ERR_VALIDATION",
        400,
        payload.error.issues,
      );
    }

    return c.json({ resolvedContent: resolveMarkdown(payload.data.content, db) });
  });

  // spec: SPK-API-001
  app.get("/api/specs/:uuid", (c) => {
    const parsedUuid = parseUuidParam(c.req.param("uuid"));
    if (parsedUuid.error) {
      return parsedUuid.error;
    }

    const { uuid } = parsedUuid;
    const spec = db.select().from(specs).where(eq(specs.uuid, uuid)).get();

    if (!spec) {
      return errorResponse("Spec chunk not found", "ERR_SPEC_NOT_FOUND", 404);
    }

    return c.json({
      uuid: spec.uuid,
      title: spec.title,
      content: spec.content,
      updatedAt: spec.updatedAt,
    });
  });

  // spec: SPK-API-001
  app.post("/api/specs", async (c) => {
    const payload = specPayloadSchema.safeParse(await readJson(c.req.raw));
    if (!payload.success) {
      return errorResponse(
        "Request validation failed",
        "ERR_VALIDATION",
        400,
        payload.error.issues,
      );
    }

    const uuid = payload.data.uuid.toLowerCase();
    const now = Math.floor(Date.now() / 1000);
    const existing = db.select({ uuid: specs.uuid }).from(specs).where(eq(specs.uuid, uuid)).get();

    if (existing) {
      db.update(specs)
        .set({
          title: payload.data.title ?? null,
          content: payload.data.content,
          updatedAt: now,
        })
        .where(eq(specs.uuid, uuid))
        .run();

      return c.json({ success: true, uuid }, 200);
    }

    db.insert(specs)
      .values({
        uuid,
        title: payload.data.title ?? null,
        content: payload.data.content,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: specs.uuid,
        set: {
          title: payload.data.title ?? null,
          content: payload.data.content,
          updatedAt: now,
        },
      })
      .run();

    return c.json({ success: true, uuid }, 201);
  });

  // spec: SPK-API-001
  app.delete("/api/specs/:uuid", (c) => {
    const parsedUuid = parseUuidParam(c.req.param("uuid"));
    if (parsedUuid.error) {
      return parsedUuid.error;
    }

    const { uuid } = parsedUuid;
    db.delete(specs).where(eq(specs.uuid, uuid)).run();
    return c.json({ success: true, message: "Spec deleted" });
  });

  return app;
}
