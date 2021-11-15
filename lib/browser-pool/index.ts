import { BrowserPool } from 'gemini-core';

import Browser from '../browser/new-browser';
import Events from '../constants/runner-events';

import type { events } from 'gemini-core';

import type Config from '../config';
import type { Pool } from 'gemini-core/lib/types/pool';

export const create = function(config: Config, emitter: events.AsyncEmitter): Pool {
    const BrowserManager = {
        create: (id: string, version: string) => Browser.create(config, id, version),

        start: (browser: Browser) => browser.init(),
        onStart: (browser: Browser) => emitSessionEvent(emitter, browser, Events.SESSION_START),

        onQuit: (browser: Browser) => emitSessionEvent(emitter, browser, Events.SESSION_END),
        quit: (browser: Browser) => browser.quit()
    };

    const configAdapter = {
        forBrowser: (id: string) => {
            const browserConfig = config.forBrowser(id);
            return {
                parallelLimit: browserConfig.sessionsPerBrowser,
                sessionUseLimit: browserConfig.testsPerSession
            };
        },

        getBrowserIds: () => config.getBrowserIds(),

        get system() {
            return config.system;
        }
    };

    return BrowserPool.create(BrowserManager, {
        logNamespace: 'hermione',
        config: configAdapter
    });
};

function emitSessionEvent(emitter: events.AsyncEmitter, browser: Browser, event: string | symbol) {
    return emitter.emitAndWait(event, browser.publicAPI, {browserId: browser.id, sessionId: browser.sessionId});
}
