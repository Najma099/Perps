import {
  BALANCES,
  FILLS,
  ORDERBOOKS,
  type PositionType,
  type Position,
} from "../store/perp-store";
import { emitEvent } from "../utils/events";
import { matchOrder, emitOrderbookUpdate } from "./perbs.handler";

export const liquidatePosition = async (
  position: Position,
  market: string,
  markPrice: number,
) => {
  const book = ORDERBOOKS.get(market);
  if (!book) return;

  const closingSide: PositionType =
    position.type === "long" ? "short" : "long";

  const { filledQty, fills, modifiedLevels } = await matchOrder(
    book,
    closingSide,
    "market",
    markPrice,
    position.qty,
    position.leverage,
    position.userId,
    market,
  );

  await emitOrderbookUpdate(market, book, modifiedLevels);

  if (!FILLS.has(market)) FILLS.set(market, []);
  FILLS.get(market)!.push(...fills);

  for (const fill of fills) {
    await emitEvent("FILL_CREATED", {
      fillId:    fill.fillId,
      side:      fill.side,
      maker:     fill.maker,
      taker:     fill.taker,
      market:    fill.market,
      qty:       fill.qty,
      price:     fill.price,
      long:      fill.long,
      short:     fill.short,
      createdAt: fill.createdAt,
    });
  }

  const avgFillPrice =
    fills.length > 0 && filledQty > 0
      ? fills.reduce((sum, f) => sum + f.price * f.qty, 0) / filledQty
      : markPrice;

  position.realizedPnl =
    position.type === "long"
      ? (avgFillPrice - position.averagePrice) * filledQty
      : (position.averagePrice - avgFillPrice) * filledQty;

  position.positionStatus = "closed";
  position.unrealizedPnl = 0;
  position.closedAt = Date.now();

  const userBalance = BALANCES.get(position.userId);
  if (userBalance) {
    userBalance.available += Math.max(
      0,
      position.margin + position.realizedPnl,
    );
  }

  await emitEvent("POSITION_CLOSED", {
    positionId:  position.positionId,
    userId:      position.userId,
    market:      position.market,
    realizedPnl: position.realizedPnl,
    closedAt:    position.closedAt,
  });

  if (userBalance) {
    await emitEvent("BALANCE_UPDATED", {
      userId:  position.userId,
      balance: userBalance,
    });
  }
};