"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepEqual = exports.sanitizeAndValidateRedisKey = exports.redisKeyRegex = void 0;
exports.redisKeyRegex = /^[a-zA-Z0-9:.-_]*$/;
function sanitizeAndValidateRedisKey(key) {
    // Regular expression to test key
    // This expression will allow alphanumeric characters (a-z, A-Z, 0-9) and the specified symbols (: . - _)
    const sanitizedKey = key.replace(/[\n\r\t\b]/g, '');
    if (exports.redisKeyRegex.test(key)) {
        return sanitizedKey;
    }
    else {
        throw new Error('Invalid Redis key. Allowed only alphanumeric characters (a-z, A-Z, 0-9) and the specified symbols (: . - _)`');
    }
}
exports.sanitizeAndValidateRedisKey = sanitizeAndValidateRedisKey;
function deepEqual(obj1, obj2) {
    if (obj1 === obj2) {
        return true;
    }
    if (typeof obj1 !== 'object' ||
        obj1 === null ||
        typeof obj2 !== 'object' ||
        obj2 === null) {
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
exports.deepEqual = deepEqual;
