import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

import type { AppDatabase } from "./db/client.js";
import { specs } from "./db/schema.js";
import { helpDocument } from "./help.js";
import { MAX_REQUEST_BODY_BYTES } from "./constants.js";
import { resolveMarkdown } from "./resolver.js";
import { resolvePayloadSchema, specPayloadSchema, uuidV4Schema } from "./validation.js";

type ErrorBody = {
  error: string;
  code: string;
  details?: unknown;
};

type AppOptions = {
  logger?: (message: string) => void;
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

export function createApp(db: AppDatabase, options: AppOptions = {}) {
  const app = new Hono();
  const logger = options.logger ?? console.log;

  app.notFound((c) => c.json({ error: "Route not found", code: "ERR_NOT_FOUND" }, 404));

  app.onError((error, c) => {
    if (error.message === "ERR_INVALID_JSON") {
      return c.json({ error: "Request body must be valid JSON", code: "ERR_INVALID_JSON" }, 400);
    }

    console.error(error);
    return c.json({ error: "Internal server error", code: "ERR_INTERNAL" }, 500);
  });

  app.use("*", async (c, next) => {
    const startedAt = Date.now();
    try {
      await next();
    } finally {
      logger(
        `${c.req.method} ${c.req.path} ${c.res.status} ${Date.now() - startedAt}ms`,
      );
    }
  });

  const requestBodyLimit = bodyLimit({
    maxSize: MAX_REQUEST_BODY_BYTES,
    onError: (c) =>
      c.json(
        { error: "Request body too large", code: "ERR_PAYLOAD_TOO_LARGE" },
        413,
      ),
  });
  app.use("/api/specs", requestBodyLimit);
  app.use("/api/specs/*", requestBodyLimit);

  // spec: SPK-HELP-001
  app.get("/api/help", (c) => c.json(helpDocument));

  app.get("/health", (c) => {
    try {
      db.run(sql`select 1`);
      return c.json({ status: "ok" });
    } catch (error) {
      logger(`health check failed: ${error instanceof Error ? error.message : String(error)}`);
      return c.json(
        { status: "error", error: "Database unavailable", code: "ERR_HEALTHCHECK_FAILED" },
        503,
      );
    }
  });

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
    const status = db.transaction((tx) => {
      const insertResult = tx
        .insert(specs)
        .values({
          uuid,
          title: payload.data.title ?? null,
          content: payload.data.content,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({ target: specs.uuid })
        .run();

      if (insertResult.changes > 0) {
        return 201 as const;
      }

      tx.update(specs)
        .set({
          title: payload.data.title ?? null,
          content: payload.data.content,
          updatedAt: now,
        })
        .where(eq(specs.uuid, uuid))
        .run();

      return 200 as const;
    });

    return c.json({ success: true, uuid }, status);
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
