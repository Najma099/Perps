export type EngineCommandType =
  | "onramp"
  | "open_position"
  | "cancel_position"
  | "get_equity"
  | "get_open_positions"
  | "get_closed_positions"
  | "get_open_orders"
  | "get_all_orders"
  | "get_fills"


export interface EngineRequest {
  correlationId: string;
  responseQueue: string;
  type: EngineCommandType;
  payload: Record<string, unknown>;
}

export interface EngineResponse {
  correlationId: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}