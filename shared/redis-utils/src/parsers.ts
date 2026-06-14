import {
  RedisMessageSchema,
  EngineResponseSchema,
  type EngineRequest,
  type EngineResponse,
} from "./types";

type ParseSuccess<T> = { success: true; data: T };
type ParseFailure = { success: false; error: string };
type ParseResult<T> = ParseSuccess<T> | ParseFailure;

export function parseEngineRequest(entry: {
  id: string;
  message: Record<string, string>;
}): ParseResult<EngineRequest> {
  const result = RedisMessageSchema.safeParse(entry.message);

  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(result.data.payload);
  } catch {
    return { success: false, error: "Invalid JSON payload" };
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

export function parseEngineResponse(entry: {
  id: string;
  message: Record<string, string>;
}): ParseResult<EngineResponse> {
  const result = EngineResponseSchema.safeParse(entry.message);

  if (!result.success) {
    return { success: false, error: result.error.message };
  }

  return { success: true, data: result.data as EngineResponse };
}
