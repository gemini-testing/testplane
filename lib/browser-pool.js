'use strict';

const BrowserPool = require('gemini-core').BrowserPool;
const Browser = require('./browser');
const Events = require('./constants/runner-events');

exports.create = function(config, emitter) {
    const BrowserManager = {
        create: (id) => Browser.create(config, id),

        start: (browser) => browser.init(),
        onStart: (browser) => emitBrowserEvent(emitter, browser, Events.SESSION_START),

        onQuit: (browser) => emitBrowserEvent(emitter, browser, Events.SESSION_END),
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

function emitBrowserEvent(emitter, browser, event) {
    const browserSession = Object.assign(browser.publicAPI, {browserId: browser.id});
    return emitter.emitAndWait(event, browserSession);
}
