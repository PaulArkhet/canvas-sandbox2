import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { wireframeSchemaItemInsert } from "../interfaces/artboard";

export const shapesRouter = new Hono().post(
  "/create",
  zValidator("json", wireframeSchemaItemInsert, (result) => {
    if (!result.success) console.error(result.error);
  })
);
