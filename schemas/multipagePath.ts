import { sql } from "drizzle-orm";
import {
  integer,
  text,
  pgEnum,
  pgTable,
  serial,
  varchar,
  timestamp,
} from "drizzle-orm/pg-core";

export const handleTypeArray = ["top", "left", "bottom", "right"] as const;

export const handleType = pgEnum("handleType", handleTypeArray);

export const direction = pgEnum("direction", ["vertical", "horizontal"]);

export const multipagePath = pgTable("multipage_path", {
  id: serial().primaryKey(),
  projectId: integer().notNull(),
  shapeStartId: text().notNull(),
  shapeStartHandleType: handleType().notNull(),
  shapeEndId: text().notNull(),
  shapeEndHandleType: handleType().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  editedAt: timestamp("edited_at").defaultNow().notNull(),
  pageExcludeList: varchar() // i refuse to normalize an array of ints?
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  direction: direction().notNull(),
});
