/**
 * Shared Redis/IORedis connection factory for BullMQ.
 *
 * BullMQ requires `maxRetriesPerRequest: null` to function correctly — without
 * it, the Redis client will eventually throw "maxRetriesPerRequest limit
 * reached" during long-running operations (blocking reads, etc.).
 */

import IORedis from 'ioredis'

const redisHost = process.env.REDIS_HOST || 'localhost'
const redisPort = parseInt(process.env.REDIS_PORT || '6379')
const redisPassword = process.env.REDIS_PASSWORD || undefined
const redisDb = parseInt(process.env.REDIS_DB || '0')

export const createRedisConnection = (): IORedis =>
  new IORedis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    db: redisDb,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
  })
