import jwt from 'jsonwebtoken';
import { env } from '../config';

export const createToken = (userId: string) => {
    const token = jwt.sign(userId, env.JWT_SECRET);
    return {
        token
    }
};