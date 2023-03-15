"use strict";

const chalk = require("chalk");
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
    return chalk.stripColor(log).substr(2); // remove first symbol (icon)
};
