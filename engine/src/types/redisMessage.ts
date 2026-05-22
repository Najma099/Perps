import { z } from 'zod';

export const RedisMessageSchema = z.object({
    correlationId: z.string().min(1),
    responseQueue: z.string().min(1),
    type: z.string().min(1),
    payload: z.string()
});

export type redisMessages = z.infer<typeof RedisMessageSchema>;

export interface RedisStreamMessage {
  id: string;
  message: Record<string, string>;
}

export interface RedisStream {
  name: string;
  messages: RedisStreamMessage[];
}