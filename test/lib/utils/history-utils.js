'use strict';

const {
    ARG_MAX_SIZE,
    normalizeArg
} = require('lib/utils/history-utils');

describe('history-utils', () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => sandbox.restore());

    describe('normalizeArg', () => {
        it('should stringify safely object argument', () => {
            const foo = {bar: {}};
            const arg = {foo};

            foo.bar.parent = foo;

            const normalizedArg = normalizeArg(arg);

            assert.equal(normalizedArg, '{"foo":{"bar":{"parent":"[Circular ~.foo]"}}}');
        });

        [
            {type: 'number', value: 100500},
            {type: 'string', value: 'foo'},
            {type: 'null', value: null},
            {type: 'undefined', value: undefined}
        ].forEach(({type, value}) => {
            it(`should return ${type} argument as is`, () => {
                const normalizedArg = normalizeArg(value);

                assert.isTrue(value === normalizedArg);
            });
        });

        it('should truncate too big object argument', () => {
            const arg = {someBigProperty: 'a'.repeat(ARG_MAX_SIZE + 1)};

            const normalizedArg = normalizeArg(arg);

            assert.lengthOf(normalizedArg, ARG_MAX_SIZE, `argument has size of ${ARG_MAX_SIZE}`);
        });

        it('should add "<<<too big object>>>" message to the end of truncated object argument', () => {
            const arg = {someBigProperty: 'a'.repeat(ARG_MAX_SIZE + 1)};

            const normalizedArg = normalizeArg(arg);

            assert.match(normalizedArg, /<<<too big object>>>$/);
        });

        it('should truncate too long string argument', () => {
            const arg = 'a'.repeat(ARG_MAX_SIZE + 1);

            const normalizedArg = normalizeArg(arg);

            assert.lengthOf(normalizedArg, ARG_MAX_SIZE, `argument has size of ${ARG_MAX_SIZE}`);
        });

        it('should add "<<<too long string>>>" message to the end of truncated string argument', () => {
            const arg = 'a'.repeat(ARG_MAX_SIZE + 1);

            const normalizedArg = normalizeArg(arg);

            assert.match(normalizedArg, /<<<too long string>>>$/);
        });
    });
});
