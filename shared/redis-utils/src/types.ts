import { z } from "zod";

export const RedisMessageSchema = z.object({
  correlationId: z.string().min(1),
  responseQueue: z.string().min(1),
  type: z.string().min(1),
  payload: z.string(),
});

export const EngineResponseSchema = z.object({
  correlationId: z.string().min(1),
  ok: z.string().transform((v) => v === "true"),
  data: z.string().transform((v) => JSON.parse(v)),
  error: z
    .string()
    .optional()
    .transform((v) => v || undefined),
});

export type RedisMessages = z.infer<typeof RedisMessageSchema>;

export interface RedisStreamMessage {
  id: string;
  message: Record<string, string>;
}

export interface RedisStream {
  name: string;
  messages: RedisStreamMessage[];
}

export interface EngineRequest {
  correlationId: string;
  responseQueue: string;
  type: string;
  payload: Record<string, unknown>;
}

export interface EngineResponse {
  correlationId: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}
