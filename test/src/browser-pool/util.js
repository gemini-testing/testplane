"use strict";

exports.stubBrowser = function (
    id = "default-id",
    version,
    publicAPI = {},
    config = { id, testsPerSession: Infinity },
) {
    return {
        id,
        config,
        sessionId: process.hrtime().join("_"), // must be unique
        init: sinon.stub().resolves(),
        reset: sinon.stub().resolves(),
        toPrint: sinon.stub().returns(id),
        quit: sinon.stub(),
        publicAPI,
        version,
    };
};
