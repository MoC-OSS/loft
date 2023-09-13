import { DateTime } from 'luxon';
import { OutputContext } from './@types';
export const redisKeyRegex = /^[a-zA-Z0-9:_\.-]*$/;

export function getTimestamp() {
  return DateTime.local().toUTC().toSeconds();
}

type SanitizeRedisKey = string;
export function sanitizeAndValidateRedisKey(key: string): SanitizeRedisKey {
  // Regular expression to test key
  // This expression will allow alphanumeric characters (a-z, A-Z, 0-9) and the specified symbols (: . - _)
  const sanitizedKey = key.replace(/[\n\r\t\b]/g, '');

  if (redisKeyRegex.test(key)) {
    return sanitizedKey;
  } else {
    throw new Error(
      'Invalid Redis key. Allowed only alphanumeric characters (a-z, A-Z, 0-9) and the specified symbols (: . - _)`',
    );
  }
}

export function deepEqual(
  obj1: Record<string, any>,
  obj2: Record<string, any>,
) {
  if (obj1 === obj2) {
    return true;
  }

  if (
    typeof obj1 !== 'object' ||
    obj1 === null ||
    typeof obj2 !== 'object' ||
    obj2 === null
  ) {
    return false;
  }

  let keys1 = Object.keys(obj1);
  let keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (let key of keys1) {
    if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) {
      return false;
    }
  }

  return true;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isNotUndefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

// A function to get the content of a choice by index
export function getContentOfChoiceByIndex(
  ctx: OutputContext,
  index: number = 0,
): string | undefined {
  return ctx.llmResponse?.candidates[index].content;
}

// A function to modify the content of a choice by index
export function modifyContentOfChoiceByIndex(
  ctx: OutputContext,
  index: number,
  newContent: string,
): void {
  const choiceMessage = ctx.llmResponse?.candidates[index];
  if (choiceMessage) {
    choiceMessage.content = newContent;
  }
}

type NullableObject = { [key: string]: any };

export function cleanObject(obj: NullableObject): NullableObject {
  for (const key in obj) {
    if (obj[key] === null || obj[key] === undefined) {
      delete obj[key];
    } else if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      obj[key] = cleanObject(obj[key]);
      if (Object.keys(obj[key]).length === 0) {
        delete obj[key];
      }
    }
  }
  return obj;
}
