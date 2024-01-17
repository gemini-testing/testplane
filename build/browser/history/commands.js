"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createScope = exports.getElementCommands = exports.getBrowserCommands = void 0;
var Scopes;
(function (Scopes) {
    Scopes["BROWSER"] = "b";
    Scopes["ELEMENT"] = "e";
})(Scopes || (Scopes = {}));
const wdioBrowserCommands = [
    "$$",
    "$",
    "action",
    "actions",
    "call",
    "custom$$",
    "custom$",
    "debug",
    "deleteCookies",
    "execute",
    "executeAsync",
    "getCookies",
    "getPuppeteer",
    "getWindowSize",
    "keys",
    "mock",
    "mockClearAll",
    "mockRestoreAll",
    "newWindow",
    "pause",
    "react$$",
    "react$",
    "reloadSession",
    "savePDF",
    "saveRecordingScreen",
    "saveScreenshot",
    "scroll",
    "setCookies",
    "setTimeout",
    "setWindowSize",
    "switchWindow",
    "throttle",
    "touchAction",
    "uploadFile",
    "url",
    "waitUntil",
];
const wdioElementCommands = [
    "$$",
    "$",
    "addValue",
    "clearValue",
    "click",
    "custom$",
    "custom$$",
    "doubleClick",
    "dragAndDrop",
    "getAttribute",
    "getCSSProperty",
    "getComputedRole",
    "getComputedLabel",
    "getHTML",
    "getLocation",
    "getProperty",
    "getSize",
    "getTagName",
    "getText",
    "getValue",
    "isClickable",
    "isDisplayed",
    "isDisplayedInViewport",
    "isEnabled",
    "isEqual",
    "isExisting",
    "isFocused",
    "isSelected",
    "moveTo",
    "nextElement",
    "parentElement",
    "previousElement",
    "react$",
    "react$$",
    "saveScreenshot",
    "scrollIntoView",
    "selectByAttribute",
    "selectByIndex",
    "selectByVisibleText",
    "setValue",
    "shadow$",
    "shadow$$",
    "touchAction",
    "waitForClickable",
    "waitForDisplayed",
    "waitForEnabled",
    "waitForExist",
    "waitUntil",
];
const getBrowserCommands = () => wdioBrowserCommands;
exports.getBrowserCommands = getBrowserCommands;
const getElementCommands = () => wdioElementCommands;
exports.getElementCommands = getElementCommands;
const createScope = (elementScope) => {
    return elementScope ? Scopes.ELEMENT : Scopes.BROWSER;
};
exports.createScope = createScope;
//# sourceMappingURL=commands.js.map