'use strict';
var inherit = require('inherit'),
    Pool = require('./pool'),
    q = require('q');

var LimitedPool = inherit(Pool, {
    __constructor: function(limit, underlyingPool) {
        this.underlyingPool = underlyingPool;
        this._limit = limit;
        this._deferQueue = [];
        this._launched = 0;
    },

    getBrowser: function(id) {
        if (this._canLaunchBrowser()) {
            this._launched++;
            return this._newBrowser(id);
        }

        var defer = q.defer();
        this._deferQueue.unshift({
            id: id,
            defer: defer
        });
        return defer.promise;
    },

    freeBrowser: function(browser) {
        return this.underlyingPool.freeBrowser(browser)
            .finally(this._launchNextBrowser.bind(this));
    },

    _canLaunchBrowser: function() {
        return this._launched < this._limit;
    },

    _newBrowser: function(id) {
        return this.underlyingPool.getBrowser(id)
            .catch(function(e) {
                this._launchNextBrowser();
                return q.reject(e);
            }.bind(this));
    },

    _launchNextBrowser: function() {
        var queued = this._deferQueue.pop();
        if (queued) {
            this._newBrowser(queued.id)
                .then(queued.defer.resolve, queued.defer.reject);
        } else {
            this._launched--;
        }
    }
});

module.exports = exports = LimitedPool;
