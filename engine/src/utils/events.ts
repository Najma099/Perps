import { responseClient } from "..";

export async function emitEvent(
  type: string,
  payload: Record<string, unknown>
) {
  await responseClient.xAdd(
    "stream:events",
    "*",
    {
      type,
      payload: JSON.stringify(payload),
      createdAt: String(Date.now())
    },
    { TRIM: { strategy: "MAXLEN", strategyModifier: "~", threshold: 10000 } }
  );
}