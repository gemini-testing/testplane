import type { AssertViewOpts } from "../../config/types";
import type { ChainablePromiseElement } from "@testplane/webdriverio";

export type AssertViewCommandWithSelector = (
    this: WebdriverIO.Browser,
    state: string,
    selectors: string | string[],
    opts?: AssertViewOpts,
) => Promise<void>;

export type AssertViewCommandWithoutSelector = (
    this: WebdriverIO.Browser,
    state: string,
    opts?: AssertViewOpts,
) => Promise<void>;

export type AssertViewCommand = AssertViewCommandWithSelector & AssertViewCommandWithoutSelector;

export type AssertViewElementCommand = (
    this: WebdriverIO.Element | ChainablePromiseElement<WebdriverIO.Element>,
    state: string,
    opts?: AssertViewOpts,
) => Promise<void>;
