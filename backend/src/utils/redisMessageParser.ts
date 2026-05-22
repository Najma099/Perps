import type { EngineResponse } from "./engine_client.js";
import { EngineResponseSchema } from "../types/redisMessage.js";

export function parseEngineResponse(entry: {
  id: string;
  message: Record<string, string>;
}):
  | { success: true; data: EngineResponse }
  | { success: false; error: string } {
  const result = EngineResponseSchema.safeParse(entry.message);

  if (!result.success) {
    return {
      success: false,
      error: result.error.message,
    };
  }

  return {
    success: true,
    data: result.data as EngineResponse,
  };
}
