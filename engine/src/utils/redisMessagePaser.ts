import type { EngineRequest } from "..";
import { RedisMessageSchema } from "../types/redisMessage";

export function parseEngineRequest(
  entry: {
    id: string;
    message: Record<string, string>;
  }
):
  | { success: true; data: EngineRequest }
  | { success: false; error: string }
{

  const result =
    RedisMessageSchema.safeParse(entry.message);

  if (!result.success) {
    return {
      success: false,
      error: result.error.message,
    };
  }

  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(result.data.payload);

  } catch {

    return {
      success: false,
      error: "Invalid JSON payload",
    };
  }

  return {
    success: true,
    data: {
      correlationId: result.data.correlationId,
      responseQueue: result.data.responseQueue,
      type: result.data.type,
      payload,
    },
  };
}