import type { Request, Response } from "express";
import { prisma } from "../db";
import { AuthSchema } from "../type/auth.schema";
import { sendValidationError } from "../utils/sendValidationError";
import bcrypt from 'bcrypt';
import { createToken } from "../utils/createToken";

export const signin = async (req: Request, res: Response) => {
    const parsed = AuthSchema.safeParse(req.body);
    if(!parsed.success) {
        sendValidationError(res, parsed.error);
        return;
    }
    try{
        const {username, password} = req.body;
        const existingUser = await prisma.user.findUnique({
            where: {
                username
            }
        });

        if(!existingUser) {
            res.status(409).json({
                message: "Username doesnt exits"
            });
            return;
        }

        const match = await bcrypt.compare(password, existingUser.password);
        if(!match) {
            res.status(400).json({
                message: 'Invalid Credentials'
            });
        }

        const token = createToken(existingUser.userId);
        res.status(201).json({
            message: 'user signed successfully!',
            token,
        });
    } catch(err) {
        res.status(500).json({
            message: 'Internal server error!'
        });
        return;
    }
}

export const signup = async(res: Response, req: Request) => {
    const parsed = AuthSchema.safeParse(req.body);
    if(!parsed.success) {
        sendValidationError(res, parsed.error);
        return;
    }

    try{
        const { username, password} = parsed.data;
        const existingUser = await prisma.user.findUnique({
            where: {
                username
            }
        });

        if(existingUser) {
            res.status(409).json({
                message: "User already exits"
            });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword
            }
        });

        res.status(200).json({
            message: 'user created sucessfully!'
        })

    } catch(err) {
        console.log(err);
        res.status(500).json({
            message: "Internal server error!"
        })
    }
}