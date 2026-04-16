/**
 * Adapted from: https://raw.githubusercontent.com/Financial-Times/polyfill-service
 */
function evalQuery(query: string): boolean {
    query = (query || "true")
        .replace(/^only\s+/, "")
        .replace(/(device)-([\w.]+)/g, "$1.$2")
        .replace(/([\w.]+)\s*:/g, "media.$1 ===")
        .replace(/min-([\w.]+)\s*===/g, "$1 >=")
        .replace(/max-([\w.]+)\s*===/g, "$1 <=")
        .replace(/all|screen/g, "1")
        .replace(/print/g, "0")
        .replace(/,/g, "||")
        .replace(/\band\b/g, "&&")
        .replace(/dpi/g, "")
        .replace(/(\d+)(cm|em|in|dppx|mm|pc|pt|px|rem)/g, function ($0: string, $1: string, $2: string): string {
            return (
                parseFloat($1) *
                ($2 === "cm"
                    ? 0.3937 * 96
                    : $2 === "em" || $2 === "rem"
                    ? 16
                    : $2 === "in" || $2 === "dppx"
                    ? 96
                    : $2 === "mm"
                    ? (0.3937 * 96) / 10
                    : $2 === "pc"
                    ? (12 * 96) / 72
                    : $2 === "pt"
                    ? 96 / 72
                    : 1)
            ).toString();
        });
    // @ts-expect-error global might be present in old browsers
    const globalObj = window || globalThis || global;
    return new Function("media", "try{ return !!(%s) }catch(e){ return false }".replace("%s", query))({
        width: globalObj.innerWidth,
        height: globalObj.innerHeight,
        orientation: globalObj.orientation || "landscape",
        device: {
            width: globalObj.screen.width,
            height: globalObj.screen.height,
            orientation: globalObj.screen.orientation || globalObj.orientation || "landscape"
        }
    });
}

interface MediaQueryListPolyfill {
    matches: boolean;
    media: string;
    addListener: (listener: () => void) => void;
    removeListener: (listener: () => void) => void;
}

function MediaQueryList(this: MediaQueryListPolyfill): void {
    this.matches = false;
    this.media = "invalid";
}

MediaQueryList.prototype.addListener = function addListener(listener: () => void): void {
    this.addListener.listeners.push(listener);
};

MediaQueryList.prototype.removeListener = function removeListener(listener: () => void): void {
    this.addListener.listeners.splice(this.addListener.listeners.indexOf(listener), 1);
};

export { MediaQueryList };

// <Global>.matchMedia
export function matchMedia(query: string): MediaQueryList {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = new (MediaQueryList as any)();

    if (arguments.length === 0) {
        throw new TypeError("Not enough arguments to matchMedia");
    }

    list.media = String(query);
    list.matches = evalQuery(list.media);
    list.addListener.listeners = [];

    // @ts-expect-error global might be present in old browsers
    const globalObj = window || globalThis || global;

    window.addEventListener("resize", function () {
        const listeners = [].concat(list.addListener.listeners),
            matches = evalQuery(list.media);

        if (matches !== list.matches) {
            list.matches = matches;
            for (let index = 0, length = listeners.length; index < length; ++index) {
                (listeners[index] as (...args: unknown[]) => void).call(globalObj, list);
            }
        }
    });

    return list;
}
