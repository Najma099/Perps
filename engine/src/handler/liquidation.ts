import { BALANCES, FILLS, ORDERBOOKS, type PositionType, type Position} from "../store/perp-store";
import { matchOrder } from "./perbs.handler";

export const liquidatePosition = (
    position: Position,
    market:   string,
    markPrice: number
) => {
    
    const book = ORDERBOOKS.get(market);
    if (!book) return;

    const closingSide: PositionType = position.type === 'long' ? 'short' : 'long';

    const { filledQty, fills} = matchOrder(
        book,
        closingSide,    
        'market',       
        markPrice,      
        position.qty,
        position.margin,
        position.userId,
        market
    );

    if (!FILLS.has(market)) FILLS.set(market, []);
    FILLS.get(market)!.push(...fills);
 
    const avgFillPrice = fills.length > 0
        ? fills.reduce((sum, f) => sum + f.price * f.qty, 0) / filledQty
        : markPrice;

    position.realizedPnl = position.type === 'long'
        ? (avgFillPrice - position.averagePrice) * filledQty
        : (position.averagePrice - avgFillPrice) * filledQty;

   
    const userBalance = BALANCES.get(position.userId);
    if (userBalance) {
        const marginReturned = position.margin + position.realizedPnl;
        userBalance.available += Math.max(0, marginReturned);
    }

    position.positionStatus = 'closed';
    position.unrealizedPnl  = 0;
    position.closedAt       = Date.now();
};