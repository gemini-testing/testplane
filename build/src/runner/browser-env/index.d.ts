import { MainRunner as NodejsEnvRunner } from "..";
import { TestCollection } from "../../test-collection";
import { Config } from "../../config";
import { Interceptor } from "../../events";
import type { Stats as RunnerStats } from "../../stats";
export declare class MainRunner extends NodejsEnvRunner {
    private _viteServer;
    constructor(config: Config, interceptors: Interceptor[]);
    run(testCollection: TestCollection, stats: RunnerStats): Promise<void>;
    private _useBaseUrlFromVite;
    cancel(): void;
}
