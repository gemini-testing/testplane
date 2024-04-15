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
