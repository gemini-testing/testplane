import _ from 'lodash';
import path from 'path';

import CommonConfig from './common-config';

import type { Config, CommonOptions } from '../types/config';

type BrowserOptions = CommonOptions & {
    id: string;
    system: Config['system'];
};

export default class BrowserConfig extends CommonConfig {
    constructor(private browserOptions: BrowserOptions) {
        super(browserOptions);
    }

    public getScreenshotPath(test, stateName: string): string {
        const filename = `${stateName}.png`;
        const {screenshotsDir} = this.browserOptions;

        return _.isFunction(screenshotsDir)
            ? path.resolve(screenshotsDir(test), filename)
            : path.resolve(process.cwd(), screenshotsDir, test.id(), this.browserOptions.id, filename);
    }

    public serialize(): Omit<BrowserOptions, 'system'> {
        return _.omit(this.browserOptions, ['system']);
    }

    public get id(): string {
        return this.browserOptions.id;
    }

    public get system(): Config['system'] {
        return this.browserOptions.system;
    }
};
