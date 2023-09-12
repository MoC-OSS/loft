import Redis from 'ioredis';
import Redlock from 'redlock';

import { getLogger } from '../../Logger';

const l = getLogger('redisService');

export class RedisClient extends Redis {
  private redlock: Redlock;

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly db: number,
  ) {
    super({ host, port, db });
    this.redlock = new Redlock([this], {
      driftFactor: 0.01,
      retryCount: -1,
      retryDelay: 100,
      retryJitter: 100,
    });
  }

  async lockSet(
    key: string,
    value: string,
    expirationOptions?: {
      secondsToken: 'EX';
      ttl: number;
    },
  ) {
    const resource = `locks:${key}`;
    const lock = await this.redlock.acquire([resource], 100);
    expirationOptions
      ? await this.set(
          key,
          value,
          expirationOptions.secondsToken,
          expirationOptions.ttl,
        )
      : await this.set(key, value);

    await lock.release();
  }
}
