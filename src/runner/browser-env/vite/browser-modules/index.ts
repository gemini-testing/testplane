import { remote } from "webdriverio";
import { automationProtocolPath } from "virtual:@testplane/driver";
import { MochaWrapper } from "./mocha/index.js";
import { getRunnableTitles } from "./mocha/runnable-storage.js";
import { initExpect } from "./expect.js";
import { BrowserEventNames } from "./types.js";

window.__testplane__.browser = window.browser = await remote({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    automationProtocol: automationProtocolPath as any,
    capabilities: window.__testplane__.capabilities,
});
window.expect = initExpect();

const mocha = MochaWrapper.create();
await mocha.init();

for (const fullTitle of getRunnableTitles()) {
    const { socket } = window.__testplane__;

    const [error] = (await socket.emitWithAck(BrowserEventNames.recoveryRunRunnable, { fullTitle })) as [null | Error];

    if (error) {
        throw error;
    }
}
