import type { SupportedBrowser } from "../../utils";

export type BrowserWithVersion = { browserName: SupportedBrowser; browserVersion: string };

export const getCliArgs = <T extends Record<string, boolean>>(flags?: T): string[] => {
    if (!flags) {
        return [];
    }

    const keys = Object.keys(flags).filter(Boolean);
    const enabledFlags = keys.filter(key => Boolean(flags[key]));

    return enabledFlags.map(flag => (flag.length === 1 ? `-${flag}` : `--${flag}`));
};
