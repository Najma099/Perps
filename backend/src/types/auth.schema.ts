import z from 'zod';

export const AuthSchema = z.object({
    username: z.string().min(1, 'username is required').trim(),
    password: z.string().trim().min(8, 'password must be at least 8 characters')
});