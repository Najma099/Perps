import 'dotenv/config'

function readRequired(name: string): string {
    const value = process.env[name];
    if(!value) {
        throw new Error(`Missing required env variable: ${name}`);    
    }
    return value;
}

export const env = {
    POST: process.env.PORT ?? '3000',
    JWT_SECRET: readRequired('JWT_SECRET')
}