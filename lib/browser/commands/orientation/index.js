/* global document */
'use strict';

module.exports = (browser) => {
    const {publicAPI: session, config} = browser;

    const baseOrientationFn = session.orientation.bind(session);

    session.addCommand('orientation', (orientation) => {
        if (!orientation) {
            return baseOrientationFn();
        }

        return getBodyWidth()
            .then((initialBodyWidth) => {
                return baseOrientationFn(orientation)
                    .then((result) => {
                        if (result.value.match(/Already in/)) {
                            return result;
                        }

                        return waitForOrientationChange(initialBodyWidth, orientation).then(() => result);
                    });
            });
    }, true);

    function getBodyWidth() {
        return session.execute(() => document.body.clientWidth).then(({value}) => value);
    }

    function waitForOrientationChange(initialBodyWidth, orientation) {
        const errMsg = `Orientation did not changed to '${orientation}' in ${config.waitTimeout} ms`;

        return session.waitUntil(() => isOrientationChanged(initialBodyWidth), config.waitTimeout, errMsg);
    }

    function isOrientationChanged(initialBodyWidth) {
        return getBodyWidth().then((currentBodyWidth) => currentBodyWidth !== initialBodyWidth);
    }
};
