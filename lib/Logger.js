"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLogger = void 0;
const pino_1 = __importDefault(require("pino"));
// import * as path from 'path';
const chalk_1 = __importDefault(require("chalk"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
let loggerOptions = {
    enabled: true,
    timestamp: true,
    level: 'error',
};
let transport;
if (process.env.LLM_ORCHESTRATOR_ENV === 'development') {
    loggerOptions = {
        enabled: true,
        timestamp: true,
        level: 'trace',
    };
    transport = pino_1.default.transport({
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'UTC:yyyy-mm-dd HH:MM:ss.l o',
            crlf: true,
            levelFirst: true,
            timestampKey: 'time',
            ignore: 'pid,hostname,path',
            messageFormat: `${chalk_1.default.magentaBright('[{path}]')} {msg}`,
        },
    });
}
const baseLogger = (0, pino_1.default)(loggerOptions, transport);
function getLogger(name) {
    // const pathToFile = path.relative(process.cwd(), name); // const l = getLogger(__dirname);
    return baseLogger.child({
        path: name,
    });
}
exports.getLogger = getLogger;
