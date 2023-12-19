"use strict";

const stripAnsi = require("strip-ansi");
const _ = require("lodash");

exports.mkTestStub_ = opts => {
    return _.defaults(opts || {}, {
        fullTitle: sinon.stub().returns("suite test"),
        title: "test",
        file: "path/to/test",
        browserId: "chrome",
        duration: "100500",
    });
};

exports.getDeserializedResult = log => {
    return stripAnsi(log).substr(2); // remove first symbol (icon)
};
