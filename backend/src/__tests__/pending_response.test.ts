import { describe, it, expect, beforeEach } from "bun:test";

// Re-import fresh module each test by importing directly
import {
  waitForEngineResponse,
  resolveEngineResponse,
} from "../store/pending_response";

describe("waitForEngineResponse / resolveEngineResponse", () => {
  it("resolves when a matching response arrives", async () => {
    const promise = waitForEngineResponse("corr-1", 5000);

    resolveEngineResponse({
      correlationId: "corr-1",
      ok: true,
      data: { balance: 100000 },
    });

    const result = await promise;
    expect(result.correlationId).toBe("corr-1");
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ balance: 100000 });
  });

  it("rejects on timeout", async () => {
    const promise = waitForEngineResponse("corr-timeout", 50);

    await expect(promise).rejects.toThrow("Engine response timed out");
  });

  it("ignores responses with non-matching correlationId", async () => {
    const promise = waitForEngineResponse("corr-2", 100);

    resolveEngineResponse({
      correlationId: "corr-other",
      ok: true,
      data: null,
    });

    await expect(promise).rejects.toThrow("Engine response timed out");
  });

  it("handles multiple concurrent waits", async () => {
    const p1 = waitForEngineResponse("c1", 5000);
    const p2 = waitForEngineResponse("c2", 5000);

    resolveEngineResponse({
      correlationId: "c2",
      ok: true,
      data: "second",
    });

    resolveEngineResponse({
      correlationId: "c1",
      ok: false,
      error: "failed",
    });

    const r1 = await p1;
    const r2 = await p2;

    expect(r1.ok).toBe(false);
    expect(r1.error).toBe("failed");
    expect(r2.ok).toBe(true);
    expect(r2.data).toBe("second");
  });

  it("clears timeout on successful resolution", async () => {
    const promise = waitForEngineResponse("corr-3", 100);

    resolveEngineResponse({
      correlationId: "corr-3",
      ok: true,
      data: null,
    });

    const result = await promise;
    expect(result.correlationId).toBe("corr-3");
    // If timeout wasn't cleared, there would be a dangling timer warning
  });
});
