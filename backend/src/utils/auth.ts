import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config";

export interface TokenPayload {
  userId: string;
}

export { createToken } from "./createToken.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : undefined;

  if (!token) {
    res.status(401).json({ error: "Missing auth token" });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid auth token" });
  }
}