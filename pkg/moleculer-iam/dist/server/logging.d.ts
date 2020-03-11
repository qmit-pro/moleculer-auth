/// <reference types="koa-bodyparser" />
/// <reference types="koa-passport" />
import morgan from "koa-morgan";
import { Logger, LogLevel } from "../helper/logger";
export declare type LoggingOptions = {
    format?: morgan.FormatFn | string;
    level?: LogLevel;
} & Omit<morgan.Options, "stream">;
export declare function logging(logger: Logger, opts?: LoggingOptions): import("koa-compose").Middleware<import("koa").ParameterizedContext<import("koa").DefaultState, import("koa").DefaultContext>>;
