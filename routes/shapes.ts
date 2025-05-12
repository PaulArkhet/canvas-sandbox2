import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  wireframeSchemaItemInsert,
  wireframeSchemaItemPartial,
  type Wireframe,
} from "../interfaces/artboard";
import { db } from "../db";
import {
  buttonShapes,
  pageShapes,
  shapes as shapesTable,
  textShapes,
} from "../schemas/shapes";
import { mightFail } from "might-fail";
import { HTTPException } from "hono/http-exception";
import { createSelectSchema } from "drizzle-zod";
import { eq } from "drizzle-orm";
import { z } from "zod";

const shapeSchemaMapping = {
  page: { schema: createSelectSchema(pageShapes), table: pageShapes },
  text: { schema: createSelectSchema(textShapes), table: textShapes },
  button: { schema: createSelectSchema(buttonShapes), table: buttonShapes },
} as const;

export const shapesRouter = new Hono()
  .post("/create", zValidator("json", wireframeSchemaItemInsert), async (c) => {
    const shapeProps = c.req.valid("json");

    const result = await db.transaction(async (trx) => {
      const { ...baseShapeProps } = shapeProps;
      const pageId =
        baseShapeProps.type === "page"
          ? null
          : "pageId" in shapeProps
          ? shapeProps.pageId
          : null;

      const { error: baseShapeCreateError, result: baseShape } =
        await mightFail(
          trx.insert(shapesTable).values([baseShapeProps]).returning()
        );

      if (baseShapeCreateError) {
        console.error(baseShapeCreateError);
        console.log(shapeProps);
        trx.rollback();
        throw new HTTPException(500, {
          message: "Error when creating base shape.",
          cause: baseShapeCreateError,
        });
      }

      const extraShapeTable = shapeSchemaMapping[shapeProps.type].table;

      const extraProps =
        shapeProps.type !== "page"
          ? { ...shapeProps, shapeId: baseShape[0].id, pageId }
          : { ...shapeProps, shapeId: baseShape[0].id };

      const { error: extraShapeCreateError, result: extraShapeProps } =
        await mightFail(
          trx.insert(extraShapeTable).values(extraProps).returning()
        );

      if (extraShapeCreateError) {
        trx.rollback();
        throw new HTTPException(500, {
          message: "Error when creating extra shape",
          cause: extraShapeCreateError,
        });
      }

      return { ...baseShape[0], ...extraShapeProps[0] } as Wireframe;
    });
    return c.json({ success: true, shape: result }, 200);
  })
  .post(
    "/:shapeId/update",
    zValidator("json", wireframeSchemaItemPartial),
    async (c) => {
      const { shapeId } = c.req.param();
      const shapeProps = c.req.valid("json");

      const result = await db.transaction(async (trx) => {
        const checkShapeExists = await trx
          .select({ id: shapesTable.id, type: shapesTable.type })
          .from(shapesTable)
          .where(eq(shapesTable.id, shapeId))
          .limit(1);

        if (checkShapeExists.length === 0) {
          console.log(`Shape with ID ${shapeId} not found in database`);
          return 404;
        }

        const { error: baseShapesUpdateError, result: baseShape } =
          await mightFail(
            trx
              .update(shapesTable)
              .set(shapeProps)
              .where(eq(shapesTable.id, shapeId))
              .returning()
          );

        if (baseShapesUpdateError) {
          console.log(
            `Error updating base shape: ${baseShapesUpdateError.message}`
          );
          trx.rollback();
          throw new HTTPException(500, {
            message: "Error when updating base shape properties",
            cause: baseShapesUpdateError,
          });
        }

        if (baseShape.length === 0) {
          console.log(`No rows affected when updating shape ${shapeId}`);
          return 404;
        }

        const actualShapeType = baseShape[0].type || shapeProps.type;

        if (!shapeSchemaMapping[actualShapeType]) {
          console.log(`Invalid shape type: ${actualShapeType}`);
          trx.rollback();
          throw new HTTPException(500, {
            message: `Invalid shape type: ${actualShapeType}`,
          });
        }

        const extraShapeTable = shapeSchemaMapping[actualShapeType].table;

        const extraShapeCheck = await trx
          .select()
          .from(extraShapeTable)
          .where(eq(extraShapeTable.shapeId, shapeId))
          .limit(1);

        if (extraShapeCheck.length === 0) {
          console.log(
            `No corresponding entry in ${extraShapeTable} for shape ${shapeId}`
          );
        }

        const { error: extraShapesUpdateError, result: extraUpdateResult } =
          await mightFail(
            trx
              .update(extraShapeTable)
              .set({ ...shapeProps, shapeId: baseShape[0].id })
              .where(eq(extraShapeTable.shapeId, baseShape[0].id))
              .returning()
          );

        if (extraShapesUpdateError) {
          console.log(
            `Error updating extra shape: ${extraShapesUpdateError.message}`
          );
          trx.rollback();
          throw new HTTPException(500, {
            message: "Error when updating extra shape properties",
            cause: extraShapesUpdateError,
          });
        }

        return 200;
      });

      if (result === 404) {
        console.log(`Returning 404 response for shape ${shapeId}`);
        return c.json({ success: false }, 404);
      }

      return c.json({ success: true }, 200);
    }
  )
  .post(
    "/batch-update",
    zValidator(
      "json",
      z.array(
        z.object({
          shapeId: z.string(),
          args: wireframeSchemaItemPartial,
        })
      )
    ),
    async (c) => {
      const shapeBatchUpdates = c.req.valid("json");

      console.log("Batch update request received:", shapeBatchUpdates);

      if (!shapeBatchUpdates || shapeBatchUpdates.length === 0) {
        return c.json({ success: false, message: "No shapes to update" }, 400);
      }

      const results = await db
        .transaction(async (trx) => {
          const updateResults = [];

          for (const update of shapeBatchUpdates) {
            const { shapeId, args: shapeProps } = update;

            try {
              // Check if shape exists
              const checkShapeExists = await trx
                .select({ id: shapesTable.id, type: shapesTable.type })
                .from(shapesTable)
                .where(eq(shapesTable.id, shapeId))
                .limit(1);

              if (checkShapeExists.length === 0) {
                updateResults.push({
                  shapeId,
                  success: false,
                  status: 404,
                  message: `Shape with ID ${shapeId} not found in database`,
                });
                continue;
              }

              // Update base shape
              const { error: baseShapesUpdateError, result: baseShape } =
                await mightFail(
                  trx
                    .update(shapesTable)
                    .set(shapeProps)
                    .where(eq(shapesTable.id, shapeId))
                    .returning()
                );

              if (baseShapesUpdateError) {
                updateResults.push({
                  shapeId,
                  success: false,
                  status: 500,
                  message: "Error when updating base shape properties",
                });
                continue;
              }

              if (baseShape.length === 0) {
                updateResults.push({
                  shapeId,
                  success: false,
                  status: 404,
                  message: `No rows affected when updating shape ${shapeId}`,
                });
                continue;
              }

              const actualShapeType = baseShape[0].type || shapeProps.type;

              if (!shapeSchemaMapping[actualShapeType]) {
                updateResults.push({
                  shapeId,
                  success: false,
                  status: 500,
                  message: `Invalid shape type: ${actualShapeType}`,
                });
                continue;
              }

              // Update specialized shape data
              const extraShapeTable = shapeSchemaMapping[actualShapeType].table;

              const extraShapeCheck = await trx
                .select()
                .from(extraShapeTable)
                .where(eq(extraShapeTable.shapeId, shapeId))
                .limit(1);

              if (extraShapeCheck.length === 0) {
                console.log(
                  `No corresponding entry in ${extraShapeTable} for shape ${shapeId}`
                );
              }

              const { error: extraShapesUpdateError } = await mightFail(
                trx
                  .update(extraShapeTable)
                  .set({ ...shapeProps, shapeId: baseShape[0].id })
                  .where(eq(extraShapeTable.shapeId, baseShape[0].id))
                  .returning()
              );

              if (extraShapesUpdateError) {
                updateResults.push({
                  shapeId,
                  success: false,
                  status: 500,
                  message: "Error when updating extra shape properties",
                });
                continue;
              }

              // Successfully processed this shape
              updateResults.push({
                shapeId,
                success: true,
                status: 200,
              });
            } catch (error) {
              // Catch any unexpected errors
              console.error(
                `Unexpected error updating shape ${shapeId}:`,
                error
              );
              updateResults.push({
                shapeId,
                success: false,
                status: 500,
                message: `Unexpected error: ${
                  error instanceof Error ? error.message : "Unknown error"
                }`,
              });
            }
          }

          return updateResults;
        })
        .catch((error) => {
          console.error("Transaction error:", error);
          return { transactionError: error.message };
        });

      // Handle overall transaction failure
      if ("transactionError" in results) {
        return c.json(
          {
            success: false,
            message: "Transaction failed",
            error: results.transactionError,
          },
          500
        );
      }

      const allSuccessful = results.every((result) => result.success);
      const statusCode = allSuccessful ? 200 : 207; // Use 207 Multi-Status for partial success

      return c.json(
        {
          success: allSuccessful,
          results: results,
        },
        statusCode
      );
    }
  )
  .post("/:shapeId/delete", async (c) => {
    const { shapeId } = c.req.param();

    const { error } = await mightFail(
      db.delete(shapesTable).where(eq(shapesTable.id, shapeId))
    );

    if (error) {
      throw new HTTPException(500, {
        message: "Error when deleting shape.",
        cause: error,
      });
    }
    return c.json({ success: true }, 200);
  })
  .post(
    "/batch-delete",
    zValidator(
      "json",
      z.object({
        shapeIds: z.array(z.string()),
      })
    ),
    async (c) => {
      const { shapeIds } = c.req.valid("json");

      if (!shapeIds || shapeIds.length === 0) {
        return c.json({ success: false, message: "No shapes to delete" }, 400);
      }

      const results = await db
        .transaction(async (trx) => {
          const deleteResults = [];

          for (const shapeId of shapeIds) {
            try {
              // Check if shape exists
              const checkShapeExists = await trx
                .select({ id: shapesTable.id })
                .from(shapesTable)
                .where(eq(shapesTable.id, shapeId))
                .limit(1);

              if (checkShapeExists.length === 0) {
                deleteResults.push({
                  shapeId,
                  success: false,
                  status: 404,
                  message: `Shape with ID ${shapeId} not found in database`,
                });
                continue;
              }

              // Delete the shape
              const { error: deleteError } = await mightFail(
                trx.delete(shapesTable).where(eq(shapesTable.id, shapeId))
              );

              if (deleteError) {
                deleteResults.push({
                  shapeId,
                  success: false,
                  status: 500,
                  message: `Error deleting shape: ${deleteError.message}`,
                });
                continue;
              }

              // Successfully deleted this shape
              deleteResults.push({
                shapeId,
                success: true,
                status: 200,
              });
            } catch (error) {
              // Catch any unexpected errors
              console.error(
                `Unexpected error deleting shape ${shapeId}:`,
                error
              );
              deleteResults.push({
                shapeId,
                success: false,
                status: 500,
                message: `Unexpected error: ${
                  error instanceof Error ? error.message : "Unknown error"
                }`,
              });
            }
          }

          return deleteResults;
        })
        .catch((error) => {
          console.error("Transaction error:", error);
          return { transactionError: error.message };
        });

      // Handle overall transaction failure
      if ("transactionError" in results) {
        return c.json(
          {
            success: false,
            message: "Transaction failed",
            error: results.transactionError,
          },
          500
        );
      }

      // Determine overall status code
      const allSuccessful = results.every((result) => result.success);
      const statusCode = allSuccessful ? 200 : 207; // Use 207 Multi-Status for partial success

      return c.json(
        {
          success: allSuccessful,
          results: results,
        },
        statusCode
      );
    }
  )
  .post(
    "/copy",
    zValidator(
      "json",
      z.object({
        shapes: z.array(wireframeSchemaItemInsert),
      }),
      (result) => {
        if (!result.success) console.error(result.error);
      }
    ),
    async (c) => {
      const { shapes } = c.req.valid("json");

      if (shapes.length === 0) {
        console.log(
          "Shapes copy route called with empty array, returning 204."
        );
        return c.json(204);
      }

      const result = await db.transaction(async (trx) => {
        const createdShapes: Wireframe[] = [];

        const { error: baseShapesCreateError, result: baseShapes } =
          await mightFail(trx.insert(shapesTable).values(shapes).returning());

        if (baseShapesCreateError) {
          console.error(baseShapesCreateError);
          trx.rollback();
          throw new HTTPException(500, {
            message: "Error when creating base shapes.",
            cause: baseShapesCreateError,
          });
        }

        const shapesByType: Record<string, { shape: any; baseShape: any }[]> =
          {};

        baseShapes.forEach((baseShape, index) => {
          const shape = shapes[index];
          const type = shape.type;

          if (type in shapeSchemaMapping) {
            if (!shapesByType[type]) {
              shapesByType[type] = [];
            }
            shapesByType[type].push({ shape, baseShape });
          } else {
            console.error(`Unsupported shape type: ${type}`);
          }
        });

        for (const [type, shapeBatch] of Object.entries(shapesByType)) {
          const extraShapeTable =
            shapeSchemaMapping[type as keyof typeof shapeSchemaMapping].table;

          const extraShapeValues = shapeBatch.map(({ shape, baseShape }) => {
            const shapeData = { ...shape } as any;
            delete shapeData.options;
            delete shapeData.radioOptions;

            return {
              ...shapeData,
              shapeId: baseShape.id,
            };
          });

          const { error: extraShapeCreateError, result: extraShapes } =
            await mightFail(
              trx.insert(extraShapeTable).values(extraShapeValues).returning()
            );

          if (extraShapeCreateError) {
            trx.rollback();
            throw new HTTPException(500, {
              message: `Error when creating extra shapes for type ${type}`,
              cause: extraShapeCreateError,
            });
          }

          shapeBatch.forEach((item, index) => {
            const extraShape = extraShapes[index];
            const baseShape = item.baseShape;

            const combinedShape = {
              ...baseShape,
              ...extraShape,
            } as Wireframe;

            createdShapes.push(combinedShape);
          });
        }

        return createdShapes;
      });

      return c.json({ success: true, shapes: result }, 200);
    }
  );
