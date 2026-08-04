import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// spec: SPK-DB-001
export const specs = sqliteTable("specs", {
  uuid: text("uuid").primaryKey(),
  title: text("title"),
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type Spec = typeof specs.$inferSelect;
export type NewSpec = typeof specs.$inferInsert;
