import { MARK_PRICE, ORDERBOOKS, POSITIONS } from "../store/perp-store";
import { liquidatePosition } from "./liquidation";

export const updateMarkPrice = (market: string, markPrice: number) => {
    MARK_PRICE.set(market, markPrice);

    const book = ORDERBOOKS.get(market);
    
    const allPositions = [...POSITIONS.values()].flat();
    const marketPositions = allPositions.filter(
        p => p.market === market && p.positionStatus === 'open'
    );

    for (const position of marketPositions) {
        position.unrealizedPnl = position.type === 'long'
            ? (markPrice - position.averagePrice) * position.qty
            : (position.averagePrice - markPrice) * position.qty;

        const isLiquidated = position.type === 'long'
            ? markPrice <= position.liquidationPrice   
            : markPrice >= position.liquidationPrice;  

        if (isLiquidated) {
            liquidatePosition(position, market, markPrice);
        }
    }
};