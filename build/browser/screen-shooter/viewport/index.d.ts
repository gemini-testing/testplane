export = Viewport;
declare class Viewport {
    static create(...args: any[]): import(".");
    constructor(page: any, image: any, opts: any);
    _viewport: any;
    _captureArea: {
        left: number;
        top: number;
        width: number;
        height: number;
    };
    _ignoreAreas: any;
    _image: any;
    _opts: any;
    _summaryHeight: number;
    validate(browser: any): true | import("./coord-validator/errors/height-viewport-error") | import("./coord-validator/errors/offset-viewport-error") | undefined;
    ignoreAreas(image: any, imageArea: any): Promise<void>;
    handleImage(image: any, area?: {}): Promise<void>;
    composite(): Promise<any>;
    save(path: any): Promise<any>;
    extendBy(physicalScrollHeight: any, newImage: any): Promise<void>;
    getVerticalOverflow(): number;
    _sanitize(area: any): {
        left: number;
        top: number;
        width: number;
        height: number;
    };
    _getIntersection(...areas: any[]): {
        left: number;
        top: number;
        width: number;
        height: number;
    } | null;
    _shiftArea(area: any, { left, top }?: {
        left: any;
        top: any;
    }): {
        left: any;
        top: any;
        width: any;
        height: any;
    };
    _transformToCaptureArea(area: any): {
        left: any;
        top: any;
        width: any;
        height: any;
    };
    _transformToViewportOrigin(area: any): {
        left: any;
        top: any;
        width: any;
        height: any;
    };
}
