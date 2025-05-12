import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";
import { serve } from "bun";
import { shapesRouter } from "./routes/shapes";
import { multipagePathRouter } from "./routes/multipage-path";
const cron = require("cron");
const https = require("https");

const backendUrl = "https://canvas-sandbox2.onrender.com";
const job = new cron.CronJob("*/14 * * * *", () => {
  console.log("restarting server");
  https.get(backendUrl, (res: any) => {
    if (res.statusCode === 200) {
      console.log("Server restarted");
    } else {
      console.log("failed to restart");
    }
  });
});

job.start();

const app = new Hono();
const PORT = parseInt(process.env.PORT!) || 3333;
app.use("*", logger());
app.use("*", cors());

const apiRoutes = app
  .basePath("/api/v0")
  .route("/multipage-paths", multipagePathRouter)
  .route("/shapes", shapesRouter);

app.use("/*", serveStatic({ root: "./frontend/dist" }));
app.get("/*", async (c) => {
  try {
    const indexHtml = await Bun.file("./frontend/dist/index.html").text();
    return c.html(indexHtml);
  } catch (error) {
    console.error("Error reading index.html:", error);
    return c.text("Internal Server Error", 500);
  }
});

const server = serve({
  port: PORT,
  fetch: app.fetch,
});

console.log("Server running on port", PORT);
