import 'dotenv/config'

function readRequired(name: string): string {
    const value = process.env[name];
    if(!value) {
        throw new Error(`Missing required env variable: ${name}`);    
    }
    return value;
}

export const env = {
    PORT: process.env.PORT ?? '3000',
    JWT_SECRET: readRequired('JWT_SECRET'),
    CORS_ORIGIN: process.env.CORS_ORIGIN ?? '',
    incomingQueue: process.env.INCOMING_QUEUE ?? "backend-to-engine-broker",
    responseQueue: `response-queue-${process.env.BACKEND_QUEUE_ID ?? "1" }`,
    engineTimeoutMs: Number(process.env.ENGINE_TIMEOUT_MS ?? "30000"),
    redisUrl: readRequired("REDIS_URL")
}