enum SCROLL_DIR_NAME {
    top = 'scrollTop',
    left = 'scrollLeft'
}

enum PAGE_OFFSET_NAME {
    x = 'pageXOffset',
    y = 'pageYOffset'
}

export const each = arrayUtil(Array.prototype.forEach, myForEach);
export const some = arrayUtil(Array.prototype.some, mySome);
export const every = arrayUtil(Array.prototype.every, myEvery);

type NativeFuncEach = typeof Array.prototype.forEach;
type NativeFuncSome = typeof Array.prototype.some;
type NativeFuncEvery = typeof Array.prototype.every;
type NativeFunc = NativeFuncEach | NativeFuncSome | NativeFuncEvery;

type Callback<T, C, R> = (this: C, value: T, index: number, array: Array<T>) => R;

type ContextFuncEach = <T, C>(ctx: Array<T>, cb: Callback<T, C, void>, thisArg?: C) => void;
type ContextFuncSome = <T, C>(ctx: Array<T>, cb: Callback<T, C, boolean>, thisArg?: C) => boolean;
type ContextFuncEvery = <T, C>(ctx: Array<T>, cb: Callback<T, C, boolean>, thisArg?: C) => boolean;
type ContextFunc = ContextFuncEach | ContextFuncSome | ContextFuncEvery;

function arrayUtil(nativeFunc: NativeFuncEach | undefined, shimFunc: typeof myForEach): ContextFuncEach;
function arrayUtil(nativeFunc: NativeFuncSome | undefined, shimFunc: typeof mySome): ContextFuncSome;
function arrayUtil(nativeFunc: NativeFuncEvery | undefined, shimFunc: typeof myEvery): ContextFuncEvery;
function arrayUtil(nativeFunc: NativeFunc | undefined, shimFunc: ContextFunc): ContextFunc {
    return nativeFunc ? contextify(nativeFunc) : shimFunc;
}

/**
 * Makes function f to accept context as a
 * first argument
 */
function contextify(f: NativeFunc): ContextFunc {
    return function<T>(ctx: Array<T>, ...rest: Parameters<typeof f>): ReturnType<typeof f> {
        return f.apply(ctx, rest);
    };
}

function myForEach<T, C>(array: Array<T>, cb: Callback<T, C, void>, context?: C): void {
    for (let i = 0; i < array.length; i++) {
        cb.call(context as C, array[i], i, array);
    }
}

function mySome<T, C>(array: Array<T>, cb: Callback<T, C, boolean>, context?: C): boolean {
    for (let i = 0; i < array.length; i++) {
        if (cb.call(context as C, array[i], i, array)) {
            return true;
        }
    }

    return false;
}

function myEvery<T, C>(array: Array<T>, cb: Callback<T, C, boolean>, context?: C): boolean {
    for (let i = 0; i < array.length; i++) {
        if (!cb.call(context as C, array[i], i, array)) {
            return false;
        }
    }

    return true;
}

function getScroll(scrollElem: Element | Window | undefined, direction: keyof typeof SCROLL_DIR_NAME, coord: keyof typeof PAGE_OFFSET_NAME): number {
    const scrollDir = SCROLL_DIR_NAME[direction];
    const pageOffset = PAGE_OFFSET_NAME[coord];

    if (scrollElem && !isWindow(scrollElem)) {
        return scrollElem[scrollDir];
    }

    if (typeof window[pageOffset] !== 'undefined') {
        return window[pageOffset];
    }

    return document.documentElement[scrollDir];
}

function isWindow(elem: Element | Window): elem is Window {
    return elem !== window;
}

export function getScrollTop(scrollElem?: Element | Window): number {
    return getScroll(scrollElem, 'top', 'y');
}

export function getScrollLeft(scrollElem?: Element | Window): number {
    return getScroll(scrollElem, 'left', 'x');
}

export function isSafariMobile(): boolean {
    return navigator
        && typeof navigator.vendor === 'string'
        && Boolean(navigator.vendor.match(/apple/i))
        && /(iPhone|iPad).*AppleWebKit.*Safari/i.test(navigator.userAgent);
}
