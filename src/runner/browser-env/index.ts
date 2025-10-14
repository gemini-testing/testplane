import { ViteServer } from "./vite/server";
import { MainRunner as NodejsEnvRunner } from "..";
import { TestCollection } from "../../test-collection";
import { Config } from "../../config";
import RuntimeConfig from "../../config/runtime-config";
import { Interceptor } from "../../events";
import type { Stats as RunnerStats } from "../../stats";
import defaults from "../../config/defaults";

export class MainRunner extends NodejsEnvRunner {
    private _viteServer: ViteServer;

    constructor(config: Config, interceptors: Interceptor[]) {
        super(config, interceptors);

        this._viteServer = ViteServer.create(config);
    }

    async run(testCollection: TestCollection, stats: RunnerStats): Promise<void> {
        try {
            await this._viteServer.start();
            RuntimeConfig.getInstance().extend({ viteBaseUrl: this._viteServer.baseUrl });
        } catch (err) {
            throw new Error(`Vite server failed to start: ${(err as Error).message}`);
        }

        this._useBaseUrlFromVite();
        await super.run(testCollection, stats);
    }

    private _useBaseUrlFromVite(): void {
        const viteBaseUrl = this._viteServer.baseUrl!;
        const defaultBaseUrl = defaults.baseUrl;

        if (this.config.baseUrl === defaultBaseUrl) {
            this.config.baseUrl = viteBaseUrl;
        }

        for (const broConfig of Object.values(this.config.browsers)) {
            if (broConfig.baseUrl === defaultBaseUrl) {
                broConfig.baseUrl = viteBaseUrl;
            }
        }
    }

    cancel(): void {
        super.cancel();

        this._viteServer.close();
    }
}
