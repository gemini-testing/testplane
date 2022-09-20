'use strict';

const BrowserPool = require('../core/browser-pool');
const Browser = require('../browser/new-browser');
const Events = require('../constants/runner-events');

exports.create = function(config, emitter) {
    const BrowserManager = {
        create: (id, version) => Browser.create(config, id, version),

        start: (browser) => browser.init(),
        onStart: (browser) => emitSessionEvent(emitter, browser, Events.SESSION_START),

        onQuit: (browser) => emitSessionEvent(emitter, browser, Events.SESSION_END),
        quit: (browser) => browser.quit()
    };

    const configAdapter = {
        forBrowser: (id) => {
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

function emitSessionEvent(emitter, browser, event) {
    return emitter.emitAndWait(event, browser.publicAPI, {browserId: browser.id, sessionId: browser.sessionId});
}
