/* global document */
export default browser => {
    const { publicAPI: session, config } = browser;

    if (!session.setOrientation) {
        return;
    }

    session.overwriteCommand("setOrientation", async (origSetOrientation, orientation) => {
        if (!config.waitOrientationChange) {
            return origSetOrientation(orientation);
        }

        const initialBodyWidth = await getBodyWidth();
        const result = await origSetOrientation(orientation);

        if (typeof result === "string" && result.match(/Already in/)) {
            return result;
        }

        await waitForOrientationChange(initialBodyWidth, orientation);

        return result;
    });

    function getBodyWidth() {
        return session.execute(() => document.body.clientWidth);
    }

    function waitForOrientationChange(initialBodyWidth, orientation) {
        const errMsg = `Orientation did not changed to '${orientation}' in ${config.waitTimeout} ms`;

        return session.waitUntil(() => isOrientationChanged(initialBodyWidth), config.waitTimeout, errMsg);
    }

    async function isOrientationChanged(initialBodyWidth) {
        const currentBodyWidth = await getBodyWidth();

        return currentBodyWidth !== initialBodyWidth;
    }
};
