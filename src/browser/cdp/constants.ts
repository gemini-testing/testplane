export const CDP_CONNECTION_TIMEOUT = 15000; // 15 sec
export const CDP_CONNECTION_RETRIES = 3;
export const CDP_CONNECTION_RETRY_BASE_DELAY = 500;
export const CDP_REQUEST_TIMEOUT = 15000; // 15 sec
export const CDP_REQUEST_RETRIES = 3;
export const CDP_REQUEST_RETRY_BASE_DELAY = 500;
export const CDP_MAX_REQUEST_ID = 2147483647; // INT32_MAX
export const CDP_PING_INTERVAL = 15000; // 15 sec
export const CDP_PING_TIMEOUT = 10000; // 10 sec
export const CDP_PING_MAX_SUBSEQUENT_FAILS = 2;
export const CDP_ERROR_CODE = {
    MALFORMED_RESPONSE: -32810, // Custom error code
    SEND_FAILED: -32820, // Custom error code
    TIMEOUT: -32830, // Custom error code
    CONNECTION_TERMINATED: -32840, // Custom error code
} as const;
