import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
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

app.use(helmet());

const allowedOrigins = env.CORS_ORIGIN
  ? env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:5173"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use("/signin", authLimiter);
app.use("/signup", authLimiter);

app.use(express.json({ limit: "1mb" }));
app.get("/health", async (_req, res) => {
  await pingRedis();
  res.json({ ok: true });
});

app.use(appRouter);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const isDev = process.env.NODE_ENV !== "production";
  res.status(500).json({
    error: isDev && err instanceof Error ? err.message : "internal_server_error",
  });
});

app.listen(env.PORT, () => {
  console.log(`Backend running on http://localhost:${env.PORT}`);
  console.log(`Response queue: ${env.responseQueue}`);
});