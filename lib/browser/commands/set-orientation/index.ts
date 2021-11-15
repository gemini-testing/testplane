/* global document */

import type ExistingBrowser from "../../existing-browser";

export default (browser: ExistingBrowser) => {
    const {publicAPI: session, config} = browser;

    if (!session.setOrientation) {
        return;
    }

    session.overwriteCommand('setOrientation', async (origSetOrientation, orientation) => {
        if (!config.waitOrientationChange) {
            return origSetOrientation(orientation);
        }

        const initialBodyWidth = await getBodyWidth();
        const result = await origSetOrientation(orientation);

        if (typeof result === 'string' && result.match(/Already in/)) {
            return result;
        }

        await waitForOrientationChange(initialBodyWidth, orientation);

        return result;
    });

    async function getBodyWidth(): Promise<number> {
        return session.execute(() => document.body.clientWidth);
    }

    async function waitForOrientationChange(initialBodyWidth: number, orientation: string): Promise<true|void> {
        const errMsg = `Orientation did not changed to '${orientation}' in ${config.waitTimeout} ms`;

        return session.waitUntil(() => isOrientationChanged(initialBodyWidth), config.waitTimeout, errMsg);
    }

    async function isOrientationChanged(initialBodyWidth: number): Promise<boolean> {
        const currentBodyWidth = await getBodyWidth();

        return currentBodyWidth !== initialBodyWidth;
    }
};
