import { OutputContext } from './@types';
export declare const redisKeyRegex: RegExp;
export declare function getTimestamp(): number;
type SanitizeRedisKey = string;
export declare function sanitizeAndValidateRedisKey(key: string): SanitizeRedisKey;
export declare function deepEqual(obj1: Record<string, any>, obj2: Record<string, any>): boolean;
export declare function sleep(ms: number): Promise<void>;
export declare function isNotUndefined<T>(value: T | undefined): value is T;
export declare function getContentOfChoiceByIndex(ctx: OutputContext, index?: number): string | undefined;
export declare function modifyContentOfChoiceByIndex(ctx: OutputContext, index: number, newContent: string): void;
type NullableObject = {
    [key: string]: any;
};
export declare function cleanObject(obj: NullableObject): NullableObject;
export {};
//# sourceMappingURL=helpers.d.ts.map