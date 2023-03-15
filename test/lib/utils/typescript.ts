import proxyquire from 'proxyquire';
import sinon, { type SinonStub} from 'sinon';
import _ from 'lodash';
import * as process from "process";

describe('utils/typescript', () => {
    let processBackup = _.assign({}, process);
    let processEnvBackup = _.assign({}, process.env);

    let ts: typeof import('src/utils/typescript');
    let registerStub: SinonStub;
    const REGISTER_INSTANCE = Symbol("tsNodeTesting");

    beforeEach(() => {
        registerStub = sinon.stub();
        ts = require('src/utils/typescript');
        ts = proxyquire('src/utils/typescript', {
            'ts-node': {
                register: registerStub,
                REGISTER_INSTANCE
            },
        });
    });

    afterEach(() => {
        _.set(process, REGISTER_INSTANCE, undefined);
        _.set(global, 'process', processBackup);
        _.set(process, 'env', processEnvBackup);
    });

    describe('tryToRegisterTsNode', () => {
        it('should not call register if typescript was already installed', () => {
            _.set(global, ['process', REGISTER_INSTANCE], true);

            ts.tryToRegisterTsNode();

            assert.notCalled(registerStub);
        });

        it('should respect env vars', () => {
            process.env.TS_NODE_SKIP_PROJECT = 'false';
            process.env.TS_NODE_TRANSPILE_ONLY = 'false';

            ts.tryToRegisterTsNode();

            assert.calledOnceWith(registerStub, sinon.match({
                skipProject: false,
                transpileOnly: false,
            }));
        });

        it('should use swc if it is installed', () => {
            ts = proxyquire('src/utils/typescript', {
                'ts-node': {
                    register: registerStub
                },
                '@swc/core': sinon.stub(),
            });

            ts.tryToRegisterTsNode();

            assert.calledOnceWith(registerStub, sinon.match({
                swc: true
            }));
        });

        it('should not use swc if not installed', () => {
            ts = proxyquire('src/utils/typescript', {
                'ts-node': {
                    register: registerStub
                },
                '@swc/core': null,
            });

            ts.tryToRegisterTsNode();

            assert.calledOnceWith(registerStub, sinon.match({
                swc: undefined
            }));
        });

        it('should not throw if nothing is installed', () => {
            ts = proxyquire('src/utils/typescript', {
                'ts-node': null,
                '@swc/core': null,
            });

            assert.doesNotThrow(() => ts.tryToRegisterTsNode());
        });
    });
});
