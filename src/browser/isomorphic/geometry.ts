import { assign } from "./assign";

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type Space = "page" | "viewport" | "image" | "capture";
/** css are logical pixels, device are physical pixels, usually equal to <logical pixels> * <device pixel ratio> */
export type Unit = "css" | "device";
type MainAxis = "x" | "y";
type InverseAxis = "x-inverse" | "y-inverse";
type Axis = MainAxis | InverseAxis;

export type Coord<S extends Space, U extends Unit, A extends Axis> = Brand<number, `${S}:${U}:${A}`>;
export type Length<U extends Unit, A extends MainAxis> = Brand<number, `${U}:${A}:len`>;

export type Point<S extends Space, U extends Unit> = Readonly<{
    top: Coord<S, U, "y">;
    left: Coord<S, U, "x">;
}>;

export type Size<U extends Unit> = Readonly<{
    width: Length<U, "x">;
    height: Length<U, "y">;
}>;

export type Rect<S extends Space, U extends Unit> = Point<S, U> & Size<U>;

export type YBand<S extends Space, U extends Unit> = {
    top: Coord<S, U, "y">;
    height: Length<U, "y">;
};

export type XBand<S extends Space, U extends Unit> = {
    left: Coord<S, U, "x">;
    width: Length<U, "x">;
};

export const getSize = <U extends Unit>(rect: Rect<Space, U>): Size<U> => {
    return {
        width: rect.width,
        height: rect.height,
    };
};

export const addCoords = <T extends Coord<Space, Unit, Axis>>(a: T, b: T): T => {
    return (a + b) as T;
};

export const subtractCoords = <T extends Coord<Space, Unit, Axis>>(a: T, b: T): T => {
    return (a - b) as T;
};

export const equalsSize = <T extends Size<Unit>>(a: T, b: T): boolean => {
    return a.width === b.width && a.height === b.height;
};

export const prettyPoint = <T extends Point<Space, Unit>>(point: T): string => {
    return `{ left: ${point.left}, top: ${point.top} }`;
};

export const prettySize = <T extends Size<Unit>>(size: T): string => {
    return `{ width: ${size.width}, height: ${size.height} }`;
};

export const prettyRect = <T extends Rect<Space, Unit>>(rect: T): string => {
    return `{ left: ${rect.left}, top: ${rect.top}, width: ${rect.width}, height: ${rect.height} }`;
};

export const intersectYBands = <T extends YBand<Space, Unit>>(a: T | null, b: T | null): T | null => {
    if (!a || !b) {
        return null;
    }
    const top = Math.max(a.top, b.top);
    const bottom = Math.min(a.top + a.height, b.top + b.height);

    return bottom <= top ? null : ({ top, height: bottom - top } as T);
};

export const intersectXBands = <T extends XBand<Space, Unit>>(a: T | null, b: T | null): T | null => {
    if (!a || !b) {
        return null;
    }
    const left = Math.max(a.left, b.left);
    const right = Math.min(a.left + a.width, b.left + b.width);

    return right <= left ? null : ({ left, width: right - left } as T);
};

export const getIntersection = <
    S extends Space,
    U extends Unit,
    A extends Rect<S, U> | YBand<S, U> | XBand<S, U>,
    B extends Rect<S, U> | YBand<S, U> | XBand<S, U>,
>(
    a: A | null,
    b: B | null,
): (A & B) | null => {
    if (!a || !b) return null;

    const result = { ...a, ...b };

    if ("top" in a && "top" in b) {
        const y = intersectYBands(a as YBand<S, U>, b as YBand<S, U>);
        if (!y) return null;
        assign(result, y);
    }

    if ("left" in a && "left" in b) {
        const x = intersectXBands(a as XBand<S, U>, b as XBand<S, U>);
        if (!x) return null;
        assign(result, x);
    }

    return result as A & B;
};

type GetUnit<T> = T extends Coord<Space, infer Unit, Axis> ? Unit : never;
type GetAxis<T> = T extends Coord<Space, Unit, infer Axis> ? Axis : never;

export const getHeight = <T extends Coord<Space, Unit, "y">>(a: T, b: T): Length<GetUnit<T>, GetAxis<T>> => {
    return Math.abs(a - b) as Length<GetUnit<T>, GetAxis<T>>;
};

export const getWidth = <T extends Coord<Space, Unit, "x">>(a: T, b: T): Length<GetUnit<T>, GetAxis<T>> => {
    return Math.abs(a - b) as Length<GetUnit<T>, GetAxis<T>>;
};

export const getBottom = <S extends Space, U extends Unit>(bandOrRect: YBand<S, U>): Coord<S, U, "y"> => {
    return (bandOrRect.top + bandOrRect.height) as Coord<S, U, "y">;
};

export const getRight = <S extends Space, U extends Unit>(bandOrRect: XBand<S, U>): Coord<S, U, "x"> => {
    return (bandOrRect.left + bandOrRect.width) as Coord<S, U, "x">;
};

export const getMaxLength = <U extends Unit, A extends MainAxis>(...lengths: Length<U, A>[]): Length<U, A> => {
    return Math.max(...lengths) as Length<U, A>;
};

export const getMaxCoord = <T extends Coord<Space, Unit, Axis>>(...coords: T[]): T => {
    return Math.max(...coords) as T;
};

export const getMinCoord = <T extends Coord<Space, Unit, Axis>>(...coords: T[]): T => {
    return Math.min(...coords) as T;
};

export const fromCaptureAreaToViewport = <U extends Unit>(
    coordRelativeToCaptureArea: Coord<"capture", U, "y">,
    captureAreaTopRelativeToViewport: Coord<"viewport", U, "y">,
): Coord<"viewport", U, "y"> => {
    return (coordRelativeToCaptureArea + captureAreaTopRelativeToViewport) as Coord<"viewport", U, "y">;
};

export const fromViewportToCaptureArea = <U extends Unit>(
    coordRelativeToViewport: Coord<"viewport", U, "y">,
    captureAreaTopRelativeToViewport: Coord<"viewport", U, "y">,
): Coord<"capture", U, "y"> => {
    return (coordRelativeToViewport - captureAreaTopRelativeToViewport) as Coord<"capture", U, "y">;
};

export const getCoveringRect = <T extends Rect<Space, Unit>>(rects: T[]): T => {
    if (rects.length === 0) {
        throw new Error("No rectangles to cover");
    }

    let left = rects[0].left;
    let top = rects[0].top;
    let right = getRight(rects[0]);
    let bottom = getBottom(rects[0]);

    for (let i = 1; i < rects.length; i++) {
        const r = rects[i];
        const rLeft = r.left;
        const rTop = r.top;
        left = getMinCoord(left, rLeft);
        top = getMinCoord(top, rTop);
        right = getMaxCoord(right, getRight(r));
        bottom = getMaxCoord(bottom, getBottom(r));
    }

    return { left, top, width: getWidth(left, right), height: getHeight(top, bottom) } as T;
};

type NumericShape = Rect<Space, Unit> | YBand<Space, Unit> | XBand<Space, Unit> | Size<Unit> | Point<Space, Unit>;

export const roundCoords = <T extends NumericShape>(value: T): T => {
    const v = value as unknown as Record<string, number>;
    const result: Record<string, number> = {};

    if ("top" in v) {
        const top = v.top;
        result.top = Math.floor(top);
    }

    if ("height" in v) {
        result.height = "top" in v ? Math.ceil(v.top + v.height) - result.top : Math.ceil(v.height);
    }

    if ("left" in v) {
        const left = v.left;
        result.left = Math.floor(left);
    }

    if ("width" in v) {
        result.width = "left" in v ? Math.ceil(v.left + v.width) - result.left : Math.ceil(v.width);
    }

    return result as T;
};

export const floorCoords = <T extends NumericShape>(value: T): T => {
    const v = value as unknown as Record<string, number>;
    const result: Record<string, number> = {};

    for (const key in v) {
        result[key] = Math.floor(v[key]);
    }

    return result as T;
};

export const ceilCoords = <T extends NumericShape>(value: T): T => {
    const v = value as unknown as Record<string, number>;
    const result: Record<string, number> = {};

    for (const key in v) {
        result[key] = Math.ceil(v[key]);
    }

    return result as T;
};

type CssToDevice<T> = T extends Rect<infer S, "css">
    ? Rect<S, "device">
    : T extends YBand<infer S, "css">
    ? YBand<S, "device">
    : T extends XBand<infer S, "css">
    ? XBand<S, "device">
    : T extends Size<"css">
    ? Size<"device">
    : T extends Point<infer S, "css">
    ? Point<S, "device">
    : never;

export const fromCssToDevice = <
    T extends Size<"css"> | Point<Space, "css"> | Rect<Space, "css"> | YBand<Space, "css"> | XBand<Space, "css">,
>(
    value: T,
    pixelRatio: number,
): CssToDevice<T> => {
    const v = value as unknown as Record<string, number>;
    const scaled: Record<string, number> = {};

    for (const key in v) {
        scaled[key] = v[key] * pixelRatio;
    }

    return (pixelRatio % 1 === 0 ? scaled : roundCoords(scaled as NumericShape)) as unknown as CssToDevice<T>;
};

export const fromCssToDeviceNumber: {
    <S extends Space, U extends Unit, A extends Axis>(value: Coord<S, U, A>, pixelRatio: number): Coord<S, "device", A>;
    <U extends Unit, A extends MainAxis>(value: Length<U, A>, pixelRatio: number): Length<"device", A>;
} = (value: number, pixelRatio: number): never => {
    return (value * pixelRatio) as never;
};

export const fromDeviceToCssNumber: {
    <S extends Space, U extends Unit, A extends Axis>(value: Coord<S, U, A>, pixelRatio: number): Coord<S, "css", A>;
    <U extends Unit, A extends MainAxis>(value: Length<U, A>, pixelRatio: number): Length<"css", A>;
} = (value: number, pixelRatio: number): never => {
    return (value / pixelRatio) as never;
};

export const fromBcrToRect = (bcr: DOMRect): Rect<"viewport", "css"> => {
    return {
        left: bcr.left as Coord<"viewport", "css", "x">,
        top: bcr.top as Coord<"viewport", "css", "y">,
        width: bcr.width as Length<"css", "x">,
        height: bcr.height as Length<"css", "y">,
    };
};
