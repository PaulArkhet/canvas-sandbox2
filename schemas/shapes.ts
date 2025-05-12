import {
  boolean,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  text,
  varchar,
} from "drizzle-orm/pg-core";

export const shapeTypesArray = [
  "page",
  "button",
  "inputField",
  "text",
  "checkbox",
  "radio",
  "toggle",
  "card",
  "image",
  "dropdown",
  "circle",
  "chatbot",
  "divider",
  "navigation",
  "instance",
  "rectangle",
] as const;

export const shapeTypes = pgEnum("shape_type", shapeTypesArray);

export const shapes = pgTable("shapes", {
  id: text().primaryKey().notNull(),
  xOffset: doublePrecision().notNull(),
  yOffset: doublePrecision().notNull(),
  width: integer().notNull(),
  height: integer().notNull(),
  minWidth: integer().notNull(),
  maxWidth: integer(),
  minHeight: integer().notNull(),
  maxHeight: integer(),
  isInstanceChild: boolean().notNull(),
  zIndex: integer().notNull(),
  // the shape “type” tells you which variant-specific table to join with
  type: shapeTypes().notNull(),
});

export const alignmentOptionsArray = ["left", "center", "right"] as const;
export const textAlignmentOptions = pgEnum(
  "alignment_options",
  alignmentOptionsArray
);
export const layoutOptionsArray = ["fixed-size", "auto-width"] as const;
export const textLayoutOptions = pgEnum("layout_options", layoutOptionsArray);

export const pageShapes = pgTable("page", {
  shapeId: text()
    .primaryKey()
    .references(() => shapes.id, { onDelete: "cascade" }),
  subtype: varchar().notNull(),
  title: varchar().notNull(),
  description: varchar().notNull(),
});

export const buttonShapes = pgTable("button", {
  shapeId: text()
    .primaryKey()
    .references(() => shapes.id, { onDelete: "cascade" }),
  pageId: text().references(() => pageShapes.shapeId, {
    onDelete: "set null",
  }),
  title: varchar().notNull(),
  subtype: varchar().notNull(),
  size: varchar().notNull().default("Medium"),
  width: integer().notNull().default(144),
  height: integer().notNull().default(29),
  textAlign: varchar().notNull().default("center"),
  fontWeight: varchar().notNull().default("normal"),
  fontStyle: varchar().notNull().default("normal"),
  textDecoration: varchar().notNull().default("none"),
  leadingIcon: varchar(),
  trailingIcon: varchar(),
});

export const textShapes = pgTable("text", {
  shapeId: text()
    .primaryKey()
    .references(() => shapes.id, { onDelete: "cascade" }),
  pageId: text().references(() => pageShapes.shapeId, {
    onDelete: "set null",
  }),
  fontSize: varchar().notNull(),
  fontColor: varchar().notNull(),
  isBold: boolean().notNull().default(false),
  isItalic: boolean().notNull().default(false),
  isUnderlined: boolean().notNull().default(false),
  isStrikethrough: boolean().notNull().default(false),
  alignment: textAlignmentOptions().notNull().default("left"),
  widthMode: textLayoutOptions().notNull().default("fixed-size"),
  content: text().notNull(),
});
