import WebSocket from "ws";
import { MARK_PRICE } from "../store/perp-store";
import { updateMarkPrice } from "../handler/mark-price-sweep";

type BINANCE_RAW_DATA = {
  E: number;
  s: string;
  p: string;
};

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
    const messageString = rawMessage.toString("utf-8");
    const parsedData: BINANCE_RAW_DATA[] = JSON.parse(messageString);

    if (!Array.isArray(parsedData)) return;

    for (const data of parsedData) {
      MARK_PRICE.set(data.s, parseFloat(data.p));
      await updateMarkPrice(data.s, parseFloat(data.p));
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