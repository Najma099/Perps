import WebSocket from "ws";
import { MARK_PRICE } from "../store/perp-store";
import { updateMarkPrice } from "../handler/mark-price-sweep";

type BINANCE_RAW_DATA = {
  E: number;
  s: string;
  p: string;
};

export async function initializeMarkPrice(market: string) {
  try {
    const res = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${market}`);
    if (res.ok) {
      const data = (await res.json()) as { price: string };
      const price = parseFloat(data.price);
      if (price > 0) {
        MARK_PRICE.set(market, price);
        console.log(`[engine] Initialized mark price for ${market} to ${price}`);
      }
    }
  } catch (err: any) {
    console.error(`[engine] Failed to fetch initial mark price for ${market}:`, err.message);
  }
}

export default function LiveDataFetch() {
  const url = "wss://fstream.binance.com/ws";
  const connection = new WebSocket(url);

  connection.on("open", () => {
    connection.send(
      JSON.stringify({
        method: "SUBSCRIBE",
        params: ["!markPrice@arr"],
        id: 1,
      }),
    );
  });

  connection.on("message", async (rawMessage) => {
    try {
      const messageString = rawMessage.toString("utf-8");
      const parsedData: BINANCE_RAW_DATA[] = JSON.parse(messageString);

      if (!Array.isArray(parsedData)) return;

      for (const data of parsedData) {
        MARK_PRICE.set(data.s, parseFloat(data.p));
        await updateMarkPrice(data.s, parseFloat(data.p));
      }
    } catch (err) {
      console.error("Binance WS message processing error:", err);
    }
  });

  connection.on("error", (error) => {
    console.error(`Websocket error: ${error.message}`);
  });

  connection.on("close", () => {
    console.log("Disconnected from server");
    setTimeout(LiveDataFetch, 3000);
  });
}