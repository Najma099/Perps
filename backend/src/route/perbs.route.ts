import { Router, type Request } from "express";
import { requireAuth } from "../utils/auth";
import { sendToEngine } from "../utils/engine_client";
import { asyncHandler } from "../utils/asyncHandler";

import {
  onrampSchema,
  openPositionSchema,
  cancelPositionSchema,
  getEquitySchema,
  getOpenPositionsSchema,
  getClosedPositionsSchema,
  getOpenOrdersSchema,
  getAllOrdersSchema,
  getFillsSchema,
} from "../types/exchange-schema";


const router = Router();

router.post(
  "/onramp",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = req;
    const parsed = onrampSchema.safeParse({ userId, amount: req.body.amount });
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten });
      return;
    }

    const response = await sendToEngine("onramp", parsed.data);
    res
      .status(response.ok ? 200 : 400)
      .json(response.ok ? response.data : { error: response.error });
  }),
);

router.post(
  "/order",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = req;
    const parsed = openPositionSchema.safeParse({
      userId,
      market: req.body.market,
      side: req.body.side,
      positionType: req.body.positionType,
      qty: req.body.qty,
      margin: req.body.margin,
      orderType: req.body.orderType,
      price: req.body.price,
    });
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten });
      return;
    }

    const response = await sendToEngine("open_position", parsed.data);
    res
      .status(response.ok ? 200 : 400)
      .json(response.ok ? response.data : { error: response.error });
  }),
);

router.delete(
  "/order",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = req;
    const parsed = cancelPositionSchema.safeParse({
      userId,
      orderId: req.body.orderId,
    });
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten });
      return;
    }

    const response = await sendToEngine("cancel_position", parsed.data);
    res
      .status(response.ok ? 200 : 400)
      .json(response.ok ? response.data : { error: response.error });
  }),
);

router.get(
  "/equity",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = req;
    const parsed = getEquitySchema.safeParse({ userId });
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten });
      return;
    }

    const response = await sendToEngine("get_equity", parsed.data);
    res
      .status(response.ok ? 200 : 400)
      .json(response.ok ? response.data : { error: response.error });
  }),
);

router.get(
  "/positions/open/:market",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = req;
    const parsed = getOpenPositionsSchema.safeParse({
      userId,
      market: req.params.market,
    });
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten });
      return;
    }

    const response = await sendToEngine("get_open_positions", parsed.data);
    res
      .status(response.ok ? 200 : 400)
      .json(response.ok ? response.data : { error: response.error });
  }),
);

router.get(
  "/positions/closed/:market",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = req ;
    const parsed = getClosedPositionsSchema.safeParse({
      userId,
      market: req.params.market,
    });
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten });
      return;
    }

    const response = await sendToEngine("get_closed_positions", parsed.data);
    res
      .status(response.ok ? 200 : 400)
      .json(response.ok ? response.data : { error: response.error });
  }),
);

router.get(
  "/orders/open/:market",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = req;
    const parsed = getOpenOrdersSchema.safeParse({
      userId,
      market: req.params.market,
    });
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten });
      return;
    }

    const response = await sendToEngine("get_open_orders", parsed.data);
    res
      .status(response.ok ? 200 : 400)
      .json(response.ok ? response.data : { error: response.error });
  }),
);

router.get(
  "/orders/:market",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = req;
    const parsed = getAllOrdersSchema.safeParse({
      userId,
      market: req.params.market,
    });
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten });
      return;
    }

    const response = await sendToEngine("get_all_orders", parsed.data);
    res
      .status(response.ok ? 200 : 400)
      .json(response.ok ? response.data : { error: response.error });
  }),
);

router.get(
  "/fills",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = req;
    const parsed = getFillsSchema.safeParse({
      userId,
      market: req.query.market as string | undefined,
    });
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten });
      return;
    }

    const response = await sendToEngine("get_fills", parsed.data);
    res
      .status(response.ok ? 200 : 400)
      .json(response.ok ? response.data : { error: response.error });
  }),
);

export default router;