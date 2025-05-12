import { hc } from "hono/client";
import type { ApiRoutes } from "../../../../app";

export const client = hc<ApiRoutes>("https://canvas-sandbox2.onrender.com");
