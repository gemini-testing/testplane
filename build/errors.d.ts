export const CoreError: {
    new (message: any): import("./browser/core-error");
    captureStackTrace(targetObject: Object, constructorOpt?: Function | undefined): void;
    prepareStackTrace?: ((err: Error, stackTraces: NodeJS.CallSite[]) => any) | undefined;
    stackTraceLimit: number;
};
export const CancelledError: {
    new (): import("./browser-pool/cancelled-error");
    captureStackTrace(targetObject: Object, constructorOpt?: Function | undefined): void;
    prepareStackTrace?: ((err: Error, stackTraces: NodeJS.CallSite[]) => any) | undefined;
    stackTraceLimit: number;
};
export const ClientBridgeError: {
    new (message: any): import("./browser/client-bridge/error");
    captureStackTrace(targetObject: Object, constructorOpt?: Function | undefined): void;
    prepareStackTrace?: ((err: Error, stackTraces: NodeJS.CallSite[]) => any) | undefined;
    stackTraceLimit: number;
};
export const HeightViewportError: {
    new (message: any): import("./browser/screen-shooter/viewport/coord-validator/errors/height-viewport-error");
    captureStackTrace(targetObject: Object, constructorOpt?: Function | undefined): void;
    prepareStackTrace?: ((err: Error, stackTraces: NodeJS.CallSite[]) => any) | undefined;
    stackTraceLimit: number;
};
export const OffsetViewportError: {
    new (message: any): import("./browser/screen-shooter/viewport/coord-validator/errors/offset-viewport-error");
    captureStackTrace(targetObject: Object, constructorOpt?: Function | undefined): void;
    prepareStackTrace?: ((err: Error, stackTraces: NodeJS.CallSite[]) => any) | undefined;
    stackTraceLimit: number;
};
export const AssertViewError: {
    new (message: any): import("./browser/commands/assert-view/errors/assert-view-error");
    captureStackTrace(targetObject: Object, constructorOpt?: Function | undefined): void;
    prepareStackTrace?: ((err: Error, stackTraces: NodeJS.CallSite[]) => any) | undefined;
    stackTraceLimit: number;
};
export const ImageDiffError: {
    new (stateName: any, currImg: any, refImg: any, diffOpts: any, { diffBounds, diffClusters }?: {
        diffBounds: any;
        diffClusters: any;
    }): import("./browser/commands/assert-view/errors/image-diff-error");
    create(...args: any[]): import("./browser/commands/assert-view/errors/image-diff-error");
    fromObject(data: any): import("./browser/commands/assert-view/errors/image-diff-error");
    captureStackTrace(targetObject: Object, constructorOpt?: Function | undefined): void;
    prepareStackTrace?: ((err: Error, stackTraces: NodeJS.CallSite[]) => any) | undefined;
    stackTraceLimit: number;
};
export const NoRefImageError: {
    new (stateName: any, currImg: any, refImg: any): import("./browser/commands/assert-view/errors/no-ref-image-error");
    create(...args: any[]): import("./browser/commands/assert-view/errors/no-ref-image-error");
    fromObject(data: any): import("./browser/commands/assert-view/errors/no-ref-image-error");
    captureStackTrace(targetObject: Object, constructorOpt?: Function | undefined): void;
    prepareStackTrace?: ((err: Error, stackTraces: NodeJS.CallSite[]) => any) | undefined;
    stackTraceLimit: number;
};
