import type Mocha from '@gemini-testing/mocha';

export interface Test extends Mocha.Test {
    id?: () => string;
    browserId?: string
    browserVersion?: string;
    silentSkip?: boolean;
    skipReason?: string;
    hasBrowserVersionOverwritten?: boolean;
    disabled?: boolean;
}

export interface Suite extends Mocha.Suite {
    id?: () => string;
    silentSkip?: boolean;
    skipReason?: string;
}

export interface Hook extends Mocha.Hook {
    browserId?: string;
}
