import { remote } from 'webdriverio';
import { automationProtocolPath } from "virtual:hermione";
import { MochaWrapper } from "./mocha/index.js";

const browser = await remote({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    automationProtocol: automationProtocolPath as any,
    capabilities: {
        browserName: "chrome",
        browserVersion: "109.0",
    }
});

console.log('browser:', browser);

window.browser = browser;

const mocha = MochaWrapper.create();
await mocha.init();
