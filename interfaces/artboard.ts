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

const shapeVariationsSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("page") }).merge(createSelectSchema(pageShapes)),
  z.object({ type: z.literal("text") }).merge(createSelectSchema(textShapes)),
  z
    .object({ type: z.literal("button") })
    .merge(createSelectSchema(buttonShapes)),
]);

const shapeVariationsSchemaPartial = z.discriminatedUnion("type", [
  z
    .object({ type: z.literal("page") })
    .merge(createUpdateSchema(pageShapes))
    .omit({ shapeId: true }),
  z
    .object({ type: z.literal("text") })
    .merge(createUpdateSchema(textShapes))
    .omit({ shapeId: true }),
  z
    .object({ type: z.literal("button") })
    .merge(createUpdateSchema(buttonShapes))
    .omit({ shapeId: true }),
]);

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

export const baseShapeSchema = createSelectSchema(shapesTable).omit({
  type: true,
});

export const baseShapeSchemaPartial = createUpdateSchema(shapesTable).omit({
  id: true,
  type: true,
});

export const baseShapeSchemaInsert = createInsertSchema(shapesTable);

export const wireframeSchemaItemPartial = shapeVariationsSchemaPartial.and(
  baseShapeSchemaPartial
);

export const wireframeSchemaItemInsert = shapeVariationsSchemaInsert.and(
  baseShapeSchemaInsert
);

export const wireframeSchema = z.array(
  shapeVariationsSchema.and(baseShapeSchema)
);
export type Wireframe = z.infer<typeof wireframeSchema>[number];
export type ShapeVariations = z.infer<typeof shapeVariationsSchema>;
