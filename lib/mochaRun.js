'use strict';

var Mocha = require('mocha'),
    Q = require('q'),
    URI = require('urijs'),
    _ = require('lodash'),
    inherit = require('inherit'),
    webdriverio = require('webdriverio');

/**
 * Истанс с тестами
 * Можно запускать в отдельном процессе, но при этом надо читать конфиг заново
 * В параллельном запуске будет много отдельных mochaRun
 * @param options параметры из CLI и кастомного конфига
 * @returns {*} Promise
 */

module.exports = inherit({

    __constructor: function(options) {
        this.options = options;
    },

    run: function() {
        //TODO читать заново config, когда запускаем в отдельном потоке
        return Q.Promise(function(resolve, reject) {
            var browser = this._createBrowser();
            global.browser = browser;
            this._addPrettyJavaExceptionsOutput(browser);
            this._launchCustomEnvironmentPreparation();

            // TODO читать options заново, если выпллняется в отдельном процессе
            // TODO разные famework'и
            var mocha = this._prepareMocha();

            this.options.tests.forEach(mocha.addFile.bind(mocha));

            mocha.run(function(failures) {
                if (failures) {
                    reject(failures);
                } else {
                    resolve();
                }
            });
        }.bind(this));
    },

    getOptions: function() {
        return this.options;
    },

    _createBrowser: function() {
        var gridUri = new URI(this.options.grid);
        return webdriverio.remote({
            host: this._getGridHost(gridUri),
            port: gridUri.port(),
            path: gridUri.path(),
            // TODO разделисть option на каждый запуск при распараллеливании(пока беру первый),
            // TODO нет multibrowser - сделать при распараллеливании
            desiredCapabilities: this.options.capabilities[0],
            waitforTimeout: this.options.waitTimeout,
            logLevel: this.options.debug ? 'verbose' : 'silent',
            coloredLogs: true,
            screenshotPath: this.options.screenshotPath,
            baseUrl: this.options.baseUrl
        });
    },

    _getGridHost: function(url) {
        return new URI({
            username: url.username(),
            password: url.password(),
            hostname: url.hostname()
        })
            .toString()
            // убираем //
            .slice(2);
    },

    _addPrettyJavaExceptionsOutput: function(browser) {
        browser.on('error', function(e) {
            if (_.has(e, 'body.value.class')) {
                console.error('%s: message=%s',
                    _.get(e, 'body.value.class'),
                    _.get(e, 'body.value.message')
                );
            }
        });
    },

    _launchCustomEnvironmentPreparation: function() {
        if (typeof this.options.prepareEnvironment === 'function') {
            this.options.prepareEnvironment(global.browser);
        } else {
            // TODO Error, если не задано?
            console.error('Не задан prepareEnvironment');
        }
    },

    _prepareMocha: function() {
        return new Mocha({
            reporter: this.options.reporter,
            timeout: this.options.timeout,
            useColors: true,
            slow: this.options.slow
        });
    }

});
