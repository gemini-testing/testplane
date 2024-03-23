import { Test } from "../test-reader/test-object/test.js";
import type { InterceptedEvent } from "./index.js";

export interface InterceptData {
    event?: InterceptedEvent;
    data?: Test;
}

export type InterceptHandler = (arg: InterceptData) => InterceptData | void;

export interface Interceptor {
    event: InterceptedEvent;
    handler: InterceptHandler;
}
