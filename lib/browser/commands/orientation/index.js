/* global document */
'use strict';

module.exports = (browser) => {
    const {publicAPI: session, config} = browser;

    session.addCommand('orientation', (orientation) => {
        if (!orientation) {
            return session.getOrientation();
        }

        return getBodyWidth()
            .then((initialBodyWidth) => {
                return session.setOrientation(orientation)
                    .then((result) => {
                        if (!config.waitOrientationChange) {
                            return result;
                        }

                        if (typeof result === 'string' && result.match(/Already in/)) {
                            return result;
                        }

                        return waitForOrientationChange(initialBodyWidth, orientation).then(() => result);
                    });
            });
    });

    function getBodyWidth() {
        return session.execute(() => document.body.clientWidth);
    }

    function waitForOrientationChange(initialBodyWidth, orientation) {
        const errMsg = `Orientation did not changed to '${orientation}' in ${config.waitTimeout} ms`;

        return session.waitUntil(() => isOrientationChanged(initialBodyWidth), config.waitTimeout, errMsg);
    }

    function isOrientationChanged(initialBodyWidth) {
        return getBodyWidth().then((currentBodyWidth) => currentBodyWidth !== initialBodyWidth);
    }
};
