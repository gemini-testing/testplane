"use strict";

const cmds = require("../../../../src/browser/history/commands");

describe("commands-history", () => {
    describe("commands", () => {
        describe("getBrowserCommands", () => {
            it("should return a list of commands for a browser", () => {
                assert.deepEqual(cmds.getBrowserCommands(), [
                    "$$",
                    "$",
                    "action",
                    "actions",
                    "addCommand",
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
                    "overwriteCommand",
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
                ]);
            });
        });

        describe("getElementCommands", () => {
            it("should return a list of commands for an element", () => {
                assert.deepEqual(cmds.getElementCommands(), [
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
                    "getComputedLabel",
                    "getComputedRole",
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
                ]);
            });
        });

        describe("createScope", () => {
            it("should return an element scope", () => {
                assert(cmds.createScope(true), "e");
            });

            it("should return a browser scope", () => {
                assert(cmds.createScope(), "b");
            });
        });
    });
});
