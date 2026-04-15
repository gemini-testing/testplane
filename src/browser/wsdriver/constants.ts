export const WSD_CONNECTION_TIMEOUT = 15000; // 15 sec
export const WSD_CONNECTION_RETRIES = 3;
export const WSD_CONNECTION_RETRY_BASE_DELAY = 500;

export const WSD_REQUEST_RETRIES = 3;
export const WSD_REQUEST_RETRY_BASE_DELAY = 500;

export const WSD_COMPRESSION_THRESHOLD_BYTES = 1024;
export const WSD_ACCEPT_ENCODING_HEADER = "wsdriver-accept-encoding";

export const WSD_COMPRESSION_TYPE = {
    ZSTD: "zstd",
    GZIP: "gzip",
} as const;
