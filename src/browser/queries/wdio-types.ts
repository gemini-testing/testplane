/// <reference types="@testplane/webdriverio" />
/*
eslint-disable @typescript-eslint/no-explicit-any
*/

export type BaseWithExecute = WebdriverIO.Browser;

export type SelectorsBase = {
    $: BaseWithExecute["$"];
    $$: BaseWithExecute["$$"];
};
