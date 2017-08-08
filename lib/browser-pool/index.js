'use strict';

const BrowserPool = require('gemini-core').BrowserPool;
const QBrowserPool = require('./q-browser-pool');
const Browser = require('../browser');
const Events = require('../constants/runner-events');

exports.create = function(config, emitter) {
    const BrowserManager = {
        create: (id) => Browser.create(config, id),

        start: (browser) => browser.init(),
        onStart: (browser) => {
            emitter.emit(Events.NEW_BROWSER, browser.publicAPI, {browserId: browser.id});
            return emitSessionEvent(emitter, browser, Events.SESSION_START);
        },

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

    return QBrowserPool.create(BrowserPool.create(BrowserManager, {
        logNamespace: 'hermione',
        config: configAdapter
    }));
};

function emitSessionEvent(emitter, browser, event) {
    return emitter.emitAndWait(event, browser.publicAPI, {browserId: browser.id});
}
