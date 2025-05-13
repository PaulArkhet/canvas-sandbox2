import { Hono } from "hono";
import { mightFail, mightFailSync } from "might-fail";
import { db } from "../db";
import { multipagePath as multipagePathTable } from "../schemas/multipagePath";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { createInsertSchema, createUpdateSchema } from "drizzle-zod";

export function assertIsParsableInt(id: string): number {
  const { result: parsedId, error: parseIdError } = mightFailSync(() =>
    z.coerce.number().int().parse(id)
  );

  if (parseIdError) {
    throw new HTTPException(400, {
      message: `Id ${id} cannot be parsed into a number.`,
      cause: parseIdError,
    });
  }

  return parsedId;
}

export const multipagePathRouter = new Hono()
  .get("/", async (c) => {
    const { error: multipagePathQueryError, result: multipagePathQueryResult } =
      await mightFail(
        db.select({ paths: multipagePathTable }).from(multipagePathTable)
      );
    if (multipagePathQueryError) {
      throw new HTTPException(500, {
        message: "Error while fetching paths",
        cause: multipagePathQueryError,
      });
    }

    return c.json({ paths: multipagePathQueryResult }, 200);
  })
  .get("/:id", async (c) => {
    const { id: multipageIdString } = c.req.param();
    const multipageId = assertIsParsableInt(multipageIdString);

    const { result: datatsetQueryResult, error: multipagePathQueryError } =
      await mightFail(
        db
          .select()
          .from(multipagePathTable)
          .where(eq(multipagePathTable.id, multipageId))
      );

    if (multipagePathQueryError) {
      throw new HTTPException(500, {
        message: "Error occurred when fetching multipagePath.",
        cause: multipagePathQueryError,
      });
    }

    return c.json({ multipagePath: datatsetQueryResult[0] });
  })
  .post(
    "/create",
    zValidator(
      "json",
      createInsertSchema(multipagePathTable).omit({
        id: true,
        editedAt: true,
        createdAt: true,
      })
    ),
    async (c) => {
      const insertValues = c.req.valid("json");
      const {
        error: multipagePathInsertError,
        result: multipagePathInsertResult,
      } = await mightFail(
        db
          .insert(multipagePathTable)
          .values({ ...insertValues })
          .returning()
      );

      if (multipagePathInsertError) {
        console.log(insertValues);
        throw new HTTPException(500, {
          message: "Error while creating multipagePath",
          cause: multipagePathInsertError,
        });
      }

      return c.json({ multipagePath: multipagePathInsertResult[0] }, 200);
    }
  )
  .post(
    "/:id/update",
    zValidator(
      "json",
      createUpdateSchema(multipagePathTable).omit({
        id: true,
        editedAt: true,
        createdAt: true,
      })
    ),
    async (c) => {
      const newValues = c.req.valid("json");
      const multipageId = assertIsParsableInt(c.req.param().id);
      const { error: updateMultipageError } = await mightFail(
        db
          .update(multipagePathTable)
          .set({ ...newValues, editedAt: new Date() })
          .where(eq(multipagePathTable.id, multipageId))
      );

      if (updateMultipageError) {
        throw new HTTPException(500, {
          message: "Error updating multipage path",
          cause: updateMultipageError,
        });
      }

      return c.json({}, 200);
    }
  )
  .post("/:id/delete", async (c) => {
    const multipageId = assertIsParsableInt(c.req.param().id);
    const { error: deleteMultipageError } = await mightFail(
      db
        .delete(multipagePathTable)
        .where(eq(multipagePathTable.id, multipageId))
    );
    console.log("delete multipage path:", multipageId);

    if (deleteMultipageError) {
      throw new HTTPException(500, {
        message: "Error deleting multipagePath.",
        cause: deleteMultipageError,
      });
    }

    return c.json({}, 200);
  });
