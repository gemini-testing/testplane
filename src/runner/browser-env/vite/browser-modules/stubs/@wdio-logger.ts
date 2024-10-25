export default function getLogger(): typeof console {
    return {
        log: (): void => {},
        info: (): void => {},
        warn: (): void => {},
        error: (): void => {},
    } as unknown as typeof console;
}

getLogger.setLogLevelsConfig = (): void => {};
