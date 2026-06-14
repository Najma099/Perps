import { describe, it, expect, mock } from "bun:test";

// Mock the config module to avoid needing env vars
mock.module("../config", () => ({
  env: {
    JWT_SECRET: "test-secret",
    REDIS_URL: "redis://localhost:6379",
  },
}));

import { parseEngineResponse } from "../utils/redisMessageParser";

describe("parseEngineResponse", () => {
  it("parses a successful response", () => {
    const entry = {
      id: "1234-0",
      message: {
        correlationId: "abc-123",
        ok: "true",
        data: JSON.stringify({ available: 100000, locked: 0 }),
        error: "",
      },
    };

    const result = parseEngineResponse(entry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.correlationId).toBe("abc-123");
      expect(result.data.ok).toBe(true);
      expect(result.data.data).toEqual({ available: 100000, locked: 0 });
      expect(result.data.error).toBeUndefined();
    }
  });

  it("parses a failed response", () => {
    const entry = {
      id: "1234-0",
      message: {
        correlationId: "abc-123",
        ok: "false",
        data: JSON.stringify(null),
        error: "Insufficient funds",
      },
    };

    const result = parseEngineResponse(entry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ok).toBe(false);
      expect(result.data.error).toBe("Insufficient funds");
    }
  });

  it("transforms empty error to undefined", () => {
    const entry = {
      id: "1234-0",
      message: {
        correlationId: "abc-123",
        ok: "true",
        data: JSON.stringify({ result: "ok" }),
        error: "",
      },
    };

    const result = parseEngineResponse(entry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.error).toBeUndefined();
    }
  });

  it("rejects missing correlationId", () => {
    const entry = {
      id: "1234-0",
      message: {
        ok: "true",
        data: JSON.stringify({}),
      } as Record<string, string>,
    };

    const result = parseEngineResponse(entry);
    expect(result.success).toBe(false);
  });

  it("rejects empty correlationId", () => {
    const entry = {
      id: "1234-0",
      message: {
        correlationId: "",
        ok: "true",
        data: JSON.stringify({}),
      },
    };

    const result = parseEngineResponse(entry);
    expect(result.success).toBe(false);
  });

  it("rejects missing ok field", () => {
    const entry = {
      id: "1234-0",
      message: {
        correlationId: "abc-123",
        data: JSON.stringify({}),
      } as Record<string, string>,
    };

    const result = parseEngineResponse(entry);
    expect(result.success).toBe(false);
  });

  it("parses data as JSON", () => {
    const entry = {
      id: "1234-0",
      message: {
        correlationId: "abc-123",
        ok: "true",
        data: JSON.stringify([1, 2, 3]),
      },
    };

    const result = parseEngineResponse(entry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data).toEqual([1, 2, 3]);
    }
  });
});
