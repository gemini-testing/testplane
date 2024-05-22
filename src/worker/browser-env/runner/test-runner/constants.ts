export const WORKER_EVENT_PREFIX = "worker";

export const SUPPORTED_ASYMMETRIC_MATCHER = {
    Any: "any",
    Anything: "anything",
    ArrayContaining: "arrayContaining",
    ObjectContaining: "objectContaining",
    StringContaining: "stringContaining",
    StringMatching: "stringMatching",
    CloseTo: "closeTo",
} as const;

export const BRO_INIT_TIMEOUT_ON_RECONNECT = 5000;
export const BRO_INIT_INTERVAL_ON_RECONNECT = 250;
