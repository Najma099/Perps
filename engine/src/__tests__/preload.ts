import { mock } from "bun:test";

mock.module("dotenv/config", () => ({}));
mock.module("@repo/db", () => ({ prisma: {} }));
mock.module("redis", () => {
  const makeClient = () => {
    const client: Record<string, any> = {
      on: () => client,
      connect: async () => client,
      xAdd: async () => "id",
      xGroupCreate: async () => "OK",
      xReadGroup: async () => null,
      xAck: async () => 1,
    };
    return client;
  };
  return { createClient: makeClient };
});
mock.module("ws", () => {
  class FakeWebSocket {
    on() { return this; }
    send() {}
    close() {}
  }
  return { default: FakeWebSocket, WebSocket: FakeWebSocket };
});
mock.module("../ws/binance", () => ({
  default: () => {},
  startBinanceWs: () => {},
  initializeMarkPrice: async () => {},
}));
mock.module("../bootstrap/hydrate", () => ({
  hydrateEngine: async () => {},
}));

// Mock the engine index module to prevent the infinite event loop
mock.module("../index", () => ({
  responseClient: {
    xAdd: async () => "id",
  },
}));

// Mock events to avoid needing Redis
mock.module("../utils/events", () => ({
  emitEvent: async () => {},
}));
