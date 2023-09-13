import Redis from 'ioredis';
import Redlock from 'redlock';
import PQueue from 'p-queue';

import { getLogger } from '../../Logger';

const l = getLogger('redisService');

export class RedisClient extends Redis {
  private redlock: Redlock;
  private queue: PQueue;
  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly db: number,
  ) {
    super({ host, port, db });
    this.redlock = new Redlock([this]);
    this.queue = new PQueue({ concurrency: 1 });
  }

  async setLock(
    key: string,
    value: string,
    expirationOptions?: {
      secondsToken: 'EX';
      ttl: number;
    },
  ) {
    await this.queue.add(async () => {
      const resource = `locks:${key}`;
      const lock = await this.redlock.acquire([resource], 100);
      try {
        expirationOptions
          ? await this.set(
              key,
              value,
              expirationOptions.secondsToken,
              expirationOptions.ttl,
            )
          : await this.set(key, value);
      } catch (error) {
        l.error(error);
      } finally {
        await lock.release();
      }
    });
  }
}
