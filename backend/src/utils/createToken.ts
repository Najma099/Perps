import jwt from "jsonwebtoken";
import { env } from "../config.js";

export function createToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: "7d" });
}
