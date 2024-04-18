const RUNNABLE_TITLES_KEY = "runnableTitles";

export const getRunnableTitles = (): string[] => {
    const { runUuid } = window.__testplane__;
    return JSON.parse(sessionStorage.getItem(`${runUuid}.${RUNNABLE_TITLES_KEY}`) as string) || [];
};

export const saveRunnableTitle = (title: string): void => {
    const { runUuid } = window.__testplane__;
    sessionStorage.setItem(
        `${runUuid}.${RUNNABLE_TITLES_KEY}`,
        JSON.stringify(new Array<string>().concat(getRunnableTitles(), title)),
    );
};
