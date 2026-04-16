// https://github.com/gemini-testing/selenoid/blob/master/wsdriver/ws_req.go#L11-L16
export const WsDriverMessage = {
    Request: 0,
    Response: 1,
} as const;

export type WsDriverMessageType = (typeof WsDriverMessage)[keyof typeof WsDriverMessage];

// https://github.com/gemini-testing/selenoid/blob/master/wsdriver/ws_req.go#L18-L24
export const WsDriverCompression = {
    None: 0,
    GZIP: 1,
    ZSTD: 2,
} as const;

export type WsDriverCompressionType = (typeof WsDriverCompression)[keyof typeof WsDriverCompression];

// https://github.com/gemini-testing/selenoid/blob/master/wsdriver/ws_req.go#L33-L60
export const WsDriverMethod = {
    get: 0,
    head: 1,
    post: 2,
    put: 3,
    delete: 4,
    connect: 5,
    options: 6,
    trace: 7,
    patch: 8,
} as const;

export type WsDriverMethodType = (typeof WsDriverMethod)[keyof typeof WsDriverMethod];

export type WsDriverRequestMethodString =
    | "get"
    | "head"
    | "post"
    | "put"
    | "delete"
    | "options"
    | "trace"
    | "patch"
    | "GET"
    | "POST"
    | "PUT"
    | "PATCH"
    | "HEAD"
    | "DELETE"
    | "OPTIONS"
    | "TRACE";

interface IncomingWsDriverGeneralMessage {
    requestId: number;
    statusCode: number;
    isProtocolError: boolean;
    requestPath: string;
    rawBody: Buffer;
}

interface IncomingWsDriverJsonMessage extends IncomingWsDriverGeneralMessage {
    isJson: true;
    body: Error | Record<string, unknown>;
}

interface IncomingWsDriverStringMessage extends IncomingWsDriverGeneralMessage {
    isJson: false;
    body: Error | string;
}

export type IncomingWsDriverMessage = IncomingWsDriverJsonMessage | IncomingWsDriverStringMessage;

export interface RequestWsDriverOptions {
    path?: string;
    method?: WsDriverRequestMethodString;
    json?: Record<string, unknown>;
}

export interface RequestWsDriverResponse {
    url: string;
    method: string;
    requestId: number;
    statusCode: number;
    statusMessage: string;
    req: {
        id: number;
        method: string;
        path: string;
        host: string;
        res: RequestWsDriverResponse;
    };
    request: {
        id: number;
        options: RequestWsDriverOptions;
        requestUrl: URL;
        response: RequestWsDriverResponse;
    };
    ok: boolean;
    rawBody: Buffer;
    body: unknown;
}
