import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { appRouter } from "./route/index.js";
import { env } from "./config.js";
import {
  connectRedis,
  listenForEngineResponses,
  pingRedis,
} from "./utils/engine_client.js";

await connectRedis();
void listenForEngineResponses();

const app = express();

app.use(cors());
app.use(express.json());
app.get("/health", async (_req, res) => {
  await pingRedis();
  res.json({ ok: true });
});

app.use(appRouter);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({
    error: err instanceof Error ? err.message : "internal_server_error",
  });
});

app.listen(env.PORT, () => {
  console.log(`Backend running on http://localhost:${env.PORT}`);
  console.log(`Response queue: ${env.responseQueue}`);
});