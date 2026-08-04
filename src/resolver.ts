import { inArray } from "drizzle-orm";

import type { AppDatabase } from "./db/client.js";
import { specs } from "./db/schema.js";
import { uuidV4PatternSource } from "./validation.js";

const referencePattern = new RegExp(
  `\\{\\{spec:(${uuidV4PatternSource})\\}\\}|\\[[^\\]]*\\]\\(spec:\\/\\/(${uuidV4PatternSource})\\)`,
  "gi",
);

// spec: SPK-RESOLVE-001
export function resolveMarkdown(content: string, db: AppDatabase): string {
  const references = [...content.matchAll(referencePattern)];
  if (references.length === 0) {
    return content;
  }

  const uuids = [...new Set(references.map((match) => (match[1] ?? match[2]).toLowerCase()))];
  const rows = db.select().from(specs).where(inArray(specs.uuid, uuids)).all();
  const contentByUuid = new Map(rows.map((row) => [row.uuid.toLowerCase(), row.content]));

  return content.replace(referencePattern, (reference, braceUuid: string, linkUuid: string) => {
    const uuid = (braceUuid ?? linkUuid).toLowerCase();
    return contentByUuid.get(uuid) ?? `> ⚠️ [Spec missing for UUID: ${braceUuid ?? linkUuid}]`;
  });
}
