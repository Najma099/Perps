import { describe, it, expect } from "bun:test";
import { AuthSchema } from "../types/auth.schema";

describe("AuthSchema", () => {
  it("accepts valid credentials", () => {
    const result = AuthSchema.safeParse({
      username: "alice",
      password: "secret1234",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe("alice");
      expect(result.data.password).toBe("secret1234");
    }
  });

  it("trims whitespace from username", () => {
    const result = AuthSchema.safeParse({
      username: "  bob  ",
      password: "password1234",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe("bob");
    }
  });

  it("trims whitespace from password", () => {
    const result = AuthSchema.safeParse({
      username: "alice",
      password: "  pass1234  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.password).toBe("pass1234");
    }
  });

  it("rejects empty username", () => {
    const result = AuthSchema.safeParse({
      username: "",
      password: "password1234",
    });
    expect(result.success).toBe(false);
  });

  it("passes whitespace-only username (min checked before trim)", () => {
    // Note: `.min(1).trim()` checks min on raw input then trims.
    // "   " passes min(1), then gets trimmed to "".
    const result = AuthSchema.safeParse({
      username: "   ",
      password: "password1234",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe("");
    }
  });

  it("rejects password shorter than 4 characters", () => {
    const result = AuthSchema.safeParse({
      username: "alice",
      password: "abc",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password that becomes too short after trimming", () => {
    const result = AuthSchema.safeParse({
      username: "alice",
      password: " ab ",
    });
    expect(result.success).toBe(false);
  });

  it("accepts password with exactly 4 characters", () => {
    const result = AuthSchema.safeParse({
      username: "alice",
      password: "abcd",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing username", () => {
    const result = AuthSchema.safeParse({ password: "password1234" });
    expect(result.success).toBe(false);
  });

  it("rejects missing password", () => {
    const result = AuthSchema.safeParse({ username: "alice" });
    expect(result.success).toBe(false);
  });

  it("rejects non-string types", () => {
    expect(
      AuthSchema.safeParse({ username: 123, password: "password1234" }).success,
    ).toBe(false);
    expect(
      AuthSchema.safeParse({ username: "alice", password: 1234 }).success,
    ).toBe(false);
  });
});
