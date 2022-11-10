'use strict';

exports.stubBrowser = function(id, version, publicAPI = {}) {
    return {
        id: id || 'default-id',
        sessionId: process.hrtime().join('_'), // must be unique
        init: sinon.stub().resolves(),
        reset: sinon.stub().resolves(),
        toPrint: sinon.stub().returns(id),
        quit: sinon.stub(),
        publicAPI,
        version
    };
};
