import z from 'zod';

export const AuthSchema = z.object({
    username: z.string().min(1, 'username is required').trim(),
    password: z.string().trim().min(4, 'password should be greater then 4 character')
});