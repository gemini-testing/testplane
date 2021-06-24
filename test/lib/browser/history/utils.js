'use strict';

const P = require('bluebird');

const {normalizeCommandArgs, runWithHooks} = require('lib/browser/history/utils');

describe('commands-history', () => {
    describe('utils', () => {
        describe('normalizeCommandArgs', () => {
            it('should return representation for an object', () => {
                assert.deepEqual(normalizeCommandArgs('click', [{some: 'data'}]), [
                    'obj'
                ]);
            });

            it('should return truncated representation for the "execute" command', () => {
                assert.deepEqual(normalizeCommandArgs('execute', []), 'code');
            });

            it('should truncate string', () => {
                const arg = 'more then 50 characters string string string string';

                assert.deepEqual(normalizeCommandArgs('click', [arg]), [
                    'more then 50 characters string string string st...'
                ]);
            });

            it('should not modify an argument if it is not string or object', () => {
                assert.deepEqual(normalizeCommandArgs('click', [false, null, 100]), [
                    false, null, 100
                ]);
            });
        });

        describe('runWithHooks', () => {
            let clock;
            let tick;

            beforeEach(() => {
                clock = sinon.useFakeTimers();
                tick = async (ms) => {
                    const p = P.resolve();

                    clock.tick(ms);

                    return p;
                };
            });

            afterEach(() => {
                clock.restore();
            });

            it('should run hooks and a target in correct sequence', async () => {
                const before = sinon.stub().callsFake(() => P.delay(1000));
                const after = sinon.stub().callsFake(() => P.delay(1000));
                const fn = sinon.stub().callsFake(() => P.delay(1000));

                runWithHooks({fn, before, after});

                await tick(1);

                assert.called(before);
                assert.notCalled(fn);
                assert.notCalled(after);

                await tick(1000);

                assert.called(fn);
                assert.notCalled(after);

                await tick(1000);

                assert.called(after);

                await tick(1000);

                assert.called(after);
            });

            it('should run hooks even if a target throws an error', async () => {
                const before = sinon.stub().callsFake(() => P.delay(1000));
                const after = sinon.stub();
                const fn = sinon.stub().callsFake(() => {
                    throw new Error('target');
                });

                runWithHooks({fn, before, after});

                await tick(1);
                await tick(1000);

                assert.called(before);
                assert.called(fn);
                assert.called(after);
            });

            it('should return a result of a target', async () => {
                const before = sinon.stub().callsFake(() => P.delay(1000));
                const after = sinon.stub().callsFake(() => P.delay(1000));
                const fn = sinon.stub().callsFake(() => P.delay(1000).then(() => 'result'));

                const prom = runWithHooks({fn, before, after});

                await tick(1);
                await tick(3000);

                const res = await prom;

                assert.equal(res, 'result');
            });
        });
    });
});
