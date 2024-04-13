import { remote } from "webdriverio";
import { automationProtocolPath } from "virtual:@testplane/driver";
import { MochaWrapper } from "./mocha/index.js";

window.__testplane__.browser = window.browser = await remote({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    automationProtocol: automationProtocolPath as any,
    capabilities: window.__testplane__.capabilities,
});

const mocha = MochaWrapper.create();
await mocha.init();
