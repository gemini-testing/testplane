export = PromiseGroup;
declare class PromiseGroup {
    _count: number;
    _fulfilledCount: number;
    _promise: Promise<any>;
    _resolve: (value: any) => void;
    _reject: (reason?: any) => void;
    add(promise: any): any;
    isFulfilled(): boolean;
    done(): Promise<any>;
}
