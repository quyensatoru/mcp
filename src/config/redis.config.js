import Redis from 'ioredis';
import { env } from './env.config.js';
import { logger } from '../helpers/logger.js';

let client = null;

export function getRedis() {
  if (client) return client;

  client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 200, 3000),
    maxRetriesPerRequest: 3,
  });

  client.on('connect', () => logger.info('Redis connected'));
  client.on('error', (err) => logger.warn({ err }, 'Redis error'));

  return client;
}
