/// <reference types='mocha' />

declare namespace Hermione {
    /* eslint-disable @typescript-eslint/no-empty-interface */
    export interface MochaSuite extends Mocha.Suite {}
    export interface MochaTest extends Mocha.Test {}
    export interface MochaRunnable extends Mocha.Runnable {}
    /* eslint-enable @typescript-eslint/no-empty-interface */
}
