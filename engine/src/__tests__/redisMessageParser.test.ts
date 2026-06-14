import { describe, it, expect } from "bun:test";
import { parseEngineRequest } from "../utils/redisMessagePaser";

describe("parseEngineRequest", () => {
  it("parses a valid message", () => {
    const entry = {
      id: "1234-0",
      message: {
        correlationId: "abc-123",
        responseQueue: "stream:response",
        type: "get_equity",
        payload: JSON.stringify({ userId: "user1" }),
      },
    };

    const result = parseEngineRequest(entry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.correlationId).toBe("abc-123");
      expect(result.data.responseQueue).toBe("stream:response");
      expect(result.data.type).toBe("get_equity");
      expect(result.data.payload).toEqual({ userId: "user1" });
    }
  });

  it("rejects missing correlationId", () => {
    const entry = {
      id: "1234-0",
      message: {
        responseQueue: "stream:response",
        type: "get_equity",
        payload: JSON.stringify({ userId: "user1" }),
      } as Record<string, string>,
    };

    const result = parseEngineRequest(entry);
    expect(result.success).toBe(false);
  });

  it("rejects missing type", () => {
    const entry = {
      id: "1234-0",
      message: {
        correlationId: "abc-123",
        responseQueue: "stream:response",
        payload: JSON.stringify({ userId: "user1" }),
      } as Record<string, string>,
    };

    const result = parseEngineRequest(entry);
    expect(result.success).toBe(false);
  });

  it("rejects missing payload", () => {
    const entry = {
      id: "1234-0",
      message: {
        correlationId: "abc-123",
        responseQueue: "stream:response",
        type: "get_equity",
      } as Record<string, string>,
    };

    const result = parseEngineRequest(entry);
    expect(result.success).toBe(false);
  });

  it("rejects invalid JSON in payload", () => {
    const entry = {
      id: "1234-0",
      message: {
        correlationId: "abc-123",
        responseQueue: "stream:response",
        type: "get_equity",
        payload: "not-valid-json{{{",
      },
    };

    const result = parseEngineRequest(entry);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid JSON payload");
    }
  });

  it("rejects empty correlationId", () => {
    const entry = {
      id: "1234-0",
      message: {
        correlationId: "",
        responseQueue: "stream:response",
        type: "get_equity",
        payload: JSON.stringify({ userId: "user1" }),
      },
    };

    const result = parseEngineRequest(entry);
    expect(result.success).toBe(false);
  });

  it("handles nested payload objects", () => {
    const entry = {
      id: "1234-0",
      message: {
        correlationId: "abc-123",
        responseQueue: "stream:response",
        type: "open_position",
        payload: JSON.stringify({
          userId: "user1",
          market: "BTCUSDT",
          side: "buy",
          qty: 1,
          leverage: 10,
          orderType: "market",
        }),
      },
    };

    const result = parseEngineRequest(entry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.payload).toEqual({
        userId: "user1",
        market: "BTCUSDT",
        side: "buy",
        qty: 1,
        leverage: 10,
        orderType: "market",
      });
    }
  });
});
