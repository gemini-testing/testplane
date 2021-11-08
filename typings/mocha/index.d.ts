/// <reference types='mocha' />

declare namespace Hermione {
    export interface MochaSuite extends Mocha.Suite {}
    export interface MochaTest extends Mocha.Test {}
    export interface MochaRunnable extends Mocha.Runnable {}
}
