const mkPassthroughFn = methodName => {
    const passEvents = (from, to, event) => {
        if (typeof event === "string") {
            from.on(event, (...args) => to[methodName](event, ...args));
            return;
        }
        event.forEach(event => passEvents(from, to, event));
    };

    return passEvents;
};

export const passthroughEvent = mkPassthroughFn("emit");
export const passthroughEventAsync = mkPassthroughFn("emitAndWait");
