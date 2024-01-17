export = BaseInformer;
declare class BaseInformer {
    static create(...args: any[]): import("./base");
    log(): void;
    warn(): void;
    error(): void;
    end(): void;
}
