import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  wireframeSchemaItemInsert,
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

const shapeSchemaMapping = {
  page: { schema: createSelectSchema(pageShapes), table: pageShapes },
  text: { schema: createSelectSchema(textShapes), table: textShapes },
  button: { schema: createSelectSchema(buttonShapes), table: buttonShapes },
} as const;

export const shapesRouter = new Hono().post(
  "/create",
  zValidator("json", wireframeSchemaItemInsert),
  async (c) => {
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
  }
);
