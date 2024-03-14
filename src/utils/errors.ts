export const shouldIgnoreUnhandledRejection = (err: Error | undefined): boolean => {
    if (!err) {
        return false;
    }

    if (err.name === "ProtocolError" || err.name === "TargetCloseError") {
        return true;
    }

    if (/Cannot extract value when objectId is given/.test(err.message) && err.stack?.includes("/puppeteer-core/")) {
        return true;
    }

    return false;
};
