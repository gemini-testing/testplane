const puppeteerErrMsgs = [/Cannot extract value when objectId is given/, /Execution context was destroyed/];

export const shouldIgnoreUnhandledRejection = (err: Error | undefined): boolean => {
    if (!err) {
        return false;
    }

    if (err.name === "ProtocolError") {
        return true;
    }

    if (puppeteerErrMsgs.some(msg => msg.test(err.message)) && err.stack?.includes("/puppeteer-core/")) {
        return true;
    }

    return false;
};
