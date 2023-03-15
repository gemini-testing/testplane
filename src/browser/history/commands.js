"use strict";

const wdioBrowserCommands = require("webdriverio/build/commands/browser").default;
const wdioElementCommands = require("webdriverio/build/commands/element").default;

const scopes = {
    BROWSER: "b",
    ELEMENT: "e",
};

exports.getBrowserCommands = () => Object.keys(wdioBrowserCommands);
exports.getElementCommands = () => Object.keys(wdioElementCommands);
exports.createScope = elementScope => (elementScope ? scopes.ELEMENT : scopes.BROWSER);
