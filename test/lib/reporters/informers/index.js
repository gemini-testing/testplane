const fs = require('fs-extra');
const proxyquire = require('proxyquire');

describe('reporters/informers', () => {
    const sandbox = sinon.sandbox.create();

    afterEach(() => sandbox.restore());

    describe('"initInformer" method', () => {
        let initInformer, createFileInformer, createConsoleInformer;

        beforeEach(() => {
            createFileInformer = sandbox.stub();
            createConsoleInformer = sandbox.stub();

            sandbox.stub(fs, 'ensureDir');

            ({initInformer} = proxyquire('build/reporters/informers', {
                './file': {create: createFileInformer},
                './console': {create: createConsoleInformer}
            }));
        });

        describe('if option "path" is passed', () => {
            it('should create directory', async () => {
                await initInformer({path: './foo/bar/baz.txt'});

                assert.calledOnceWith(fs.ensureDir, './foo/bar');
            });

            it('should create file informer', async () => {
                const opts = {path: './foo/bar/baz.txt', type: 'jsonl'};

                await initInformer(opts);

                assert.calledOnceWith(createFileInformer, opts);
            });
        });

        describe('if option "path" is not passed', () => {
            it('should not create directory', async () => {
                await initInformer({});

                assert.notCalled(fs.ensureDir);
            });

            it('should create console informer', async () => {
                const opts = {type: 'jsonl'};

                await initInformer(opts);

                assert.calledOnceWith(createConsoleInformer, opts);
            });
        });
    });
});
