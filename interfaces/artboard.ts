import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import {
  buttonShapes,
  pageShapes,
  shapes as shapesTable,
  textShapes,
} from "../schemas/shapes";
import { z } from "zod";

const shapeVariationsSchemaInsert = z.discriminatedUnion("type", [
  z
    .object({ type: z.literal("page") })
    .merge(createInsertSchema(pageShapes).omit({ shapeId: true })),
  z
    .object({ type: z.literal("text") })
    .merge(createInsertSchema(textShapes))
    .omit({ shapeId: true }),
  z
    .object({ type: z.literal("button") })
    .merge(createInsertSchema(buttonShapes))
    .omit({ shapeId: true }),
]);

export const baseShapeSchemaInsert = createInsertSchema(shapesTable);

export const wireframeSchemaItemInsert = shapeVariationsSchemaInsert.and(
  baseShapeSchemaInsert
);
