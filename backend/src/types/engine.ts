export type { EngineRequest, EngineResponse } from "@repo/redis-utils";

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
