import type Mocha from '@gemini-testing/mocha';

export function testTimeout(this: Mocha.Runnable, timeout: number): void {
    this.timeout(timeout);
}
