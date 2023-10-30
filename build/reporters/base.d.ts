export = BaseReporter;
declare class BaseReporter {
    static create(opts?: {}): Promise<import("./base")>;
    constructor(informer: any);
    informer: any;
    attachRunner(runner: any): void;
    _onTestPass(test: any): void;
    _onTestFail(test: any): void;
    _onRetry(test: any): void;
    _onTestPending(test: any): void;
    _onBeforeRunnerEnd(stats: any): void;
    _onRunnerEnd(stats: any): void;
    _onWarning(info: any): void;
    _onError(error: any): void;
    _onInfo(info: any): void;
    _logTestInfo(test: any, icon: any): void;
}
