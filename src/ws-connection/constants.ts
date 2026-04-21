export const WS_MAX_REQUEST_ID = 2147483647; // INT32_MAX
export const WS_PING_INTERVAL = 15000; // 15 sec
export const WS_PING_TIMEOUT = 10000; // 10 sec
export const WS_PING_MAX_SUBSEQUENT_FAILS = 2;
export const WS_ERROR_CODE = {
    MALFORMED_RESPONSE: -32810, // Custom error code
    SEND_FAILED: -32820, // Custom error code
    TIMEOUT: -32830, // Custom error code
    CONNECTION_TERMINATED: -32840, // Custom error code
    CONNECTION_ESTABLISHMENT: -32850, // Custom error code
    CONNECTION_BREAK: -32860, // Custom error code
    PROTOCOL_ERROR: -32680, // Custom error code
} as const;
