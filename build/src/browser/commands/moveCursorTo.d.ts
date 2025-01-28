import { ChainablePromiseElement } from "@testplane/webdriverio";
import type { Browser } from "../types";
type MoveToOptions = {
    xOffset?: number;
    yOffset?: number;
};
export type MoveCursorToCommand = (this: WebdriverIO.Element | ChainablePromiseElement, options: MoveToOptions) => Promise<void>;
declare const _default: (browser: Browser) => void;
export default _default;
