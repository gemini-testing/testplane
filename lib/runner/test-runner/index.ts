import SkippedTestRunner from './skipped-test-runner';
import InsistantTestRunner from './insistant-test-runner';

import type BrowserAgent from '../browser-agent';
import type Runner from '../runner';
import type Config from '../../config';
import type { Test } from '../../types/mocha';

export const create = function(test: Test, config: Config, browserAgent: BrowserAgent): Runner {
    return test.pending || test.disabled
        ? SkippedTestRunner.create(test)
        : InsistantTestRunner.create(test, config, browserAgent);
};
