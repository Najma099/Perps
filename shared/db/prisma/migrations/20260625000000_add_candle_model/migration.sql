-- CreateTable
CREATE TABLE "Candle" (
    "market" TEXT NOT NULL,
    "bucket" INTEGER NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Candle_market_bucket_key" ON "Candle"("market", "bucket");

-- CreateIndex
CREATE INDEX "Candle_market_bucket_idx" ON "Candle"("market", "bucket");
