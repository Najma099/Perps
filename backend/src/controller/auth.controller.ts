import type { Request, Response } from "express";
import { prisma } from "@repo/db";
import { AuthSchema } from "../types/auth.schema";
import { sendValidationError } from "../utils/sendValidationError";
import bcrypt from 'bcrypt';
import { createToken } from "../utils/createToken";

export const signin = async (req: Request, res: Response) => {
    const parsed = AuthSchema.safeParse(req.body);
    if (!parsed.success) {
        sendValidationError(res, parsed.error);
        return;
    }
    try {
        const { username, password } = parsed.data;
        const existingUser = await prisma.user.findUnique({
            where: { username }
        });

        if (!existingUser) {
            res.status(409).json({ message: "Username doesn't exist" });
            return;
        }

        const match = await bcrypt.compare(password, existingUser.password);
        if (!match) {
            res.status(400).json({ message: 'Invalid Credentials' });
            return;
        }

        const token = createToken(existingUser.userId);
        res.status(200).json({ message: 'Signed in successfully!', token });

    } catch (err) {
        res.status(500).json({ message: 'Internal server error!' });
    }
}

export const signup = async (req: Request, res: Response) => {
    const parsed = AuthSchema.safeParse(req.body);
    if (!parsed.success) {
        sendValidationError(res, parsed.error);
        return;
    }

    try {
        const { username, password } = parsed.data;
        const existingUser = await prisma.user.findUnique({
            where: { username }
        });

        if (existingUser) {
            res.status(409).json({ message: "User already exists" });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { username, password: hashedPassword }
        });

        const token = createToken(user.userId);
        res.status(201).json({
            message: 'User created successfully!',
            userId: user.userId,
            token
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Internal server error!" });
    }
}