const {EventEmitter} = require('events');
const Promise = require('bluebird');
const proxyquire = require('proxyquire').noCallThru();

describe('"initReporters" method', () => {
    const sandbox = sinon.sandbox.create();
    let initReporters, Reporter, attachRunner, runner;

    const createReporter = (attachRunner) => {
        function Reporter() {
            this.attachRunner = attachRunner;
        }

        Reporter.create = () => new Reporter();

        return Reporter;
    };

    beforeEach(() => {
        attachRunner = sandbox.stub();
        Reporter = createReporter(attachRunner);
        runner = new EventEmitter();

        ({initReporters} = proxyquire('build/reporters', {
            './reporter': Reporter
        }));
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('reporter specified as string', () => {
        it('should throw error if reporter was not found', async () => {
            await assert.isRejected(
                initReporters(['unknown-reporter'], runner),
                'No such reporter: "unknown-reporter"'
            );
        });

        it('should wait until reporter is initialized', async () => {
            const afterCreateReporter = sinon.spy().named('afterCreateReporter');
            Reporter.create = () => Promise.delay(10).then(() => {
                afterCreateReporter();
                return new Reporter();
            });

            await initReporters(['reporter'], runner);

            assert.callOrder(afterCreateReporter, attachRunner);
        });

        it('should create reporter with correct args', async () => {
            sinon.spy(Reporter, 'create');

            await initReporters(['reporter'], runner);

            assert.calledOnceWith(Reporter.create, {type: 'reporter', path: null});
        });

        it('should attach reporter to runner', async () => {
            await initReporters(['reporter'], runner);

            assert.calledOnceWith(attachRunner, runner);
        });

        it('should attach few reporters to runner', async () => {
            const attachRunner1 = sandbox.stub();
            const attachRunner2 = sandbox.stub();

            ({initReporters} = proxyquire('build/reporters', {
                './reporter-1': createReporter(attachRunner1),
                './reporter-2': createReporter(attachRunner2)
            }));

            await initReporters(['reporter-1', 'reporter-2'], runner);

            assert.calledOnceWith(attachRunner1, runner);
            assert.calledOnceWith(attachRunner2, runner);
        });
    });

    describe('reporter specified as JSON string', () => {
        it('should throw error if "type" field is not specified', async () => {
            const jsonReporter = JSON.stringify({foo: 'bar'});

            await assert.isRejected(
                initReporters([jsonReporter], runner),
                `Failed to find required "type" field in reporter definition: "${jsonReporter}"`
            );
        });

        it('should create reporter with correct args', async () => {
            sinon.spy(Reporter, 'create');
            const jsonReporter = JSON.stringify({type: 'reporter', path: './foo/bar.txt'});

            await initReporters([jsonReporter], runner);

            assert.calledOnceWith(Reporter.create, JSON.parse(jsonReporter));
        });

        it('should attach reporter to runner', async () => {
            const jsonReporter = JSON.stringify({type: 'reporter', path: './foo/bar.txt'});

            await initReporters([jsonReporter], runner);

            assert.calledOnceWith(attachRunner, runner);
        });
    });

    describe('reporter specified as object', () => {
        it('should throw error if "type" field is not specified', async () => {
            const objReporter = {foo: 'bar'};

            await assert.isRejected(
                initReporters([objReporter], runner),
                `Failed to find required "type" field in reporter definition: "${JSON.stringify(objReporter)}"`
            );
        });

        it('should create reporter with correct args', async () => {
            sinon.spy(Reporter, 'create');
            const objReporter = {type: 'reporter', path: './foo/bar.txt'};

            await initReporters([objReporter], runner);

            assert.calledOnceWith(Reporter.create, objReporter);
        });

        it('should attach reporter to runner', async () => {
            const objReporter = JSON.stringify({type: 'reporter', path: './foo/bar.txt'});

            await initReporters([objReporter], runner);

            assert.calledOnceWith(attachRunner, runner);
        });
    });

    describe('reporter specified as function', () => {
        it('should create reporter with correct args', async () => {
            const FnReporter = createReporter(sandbox.stub());
            sinon.spy(FnReporter, 'create');

            await initReporters([FnReporter], runner);

            assert.calledOnceWith(FnReporter.create, {type: null, path: null});
        });

        it('should attach reporter to runner', async () => {
            const attachRunner = sandbox.stub();
            const FnReporter = createReporter(attachRunner);

            await initReporters([FnReporter], runner);

            assert.calledOnceWith(attachRunner, runner);
        });

        it('should throw error if specified reporter does not have "create" function', async () => {
            const FnReporter = createReporter(sandbox.stub());
            FnReporter.create = null;

            try {
                await initReporters([FnReporter], runner);
            } catch (e) {
                assert.equal(e.message, 'Imported reporter must have a "create" function for initialization');
            }
        });

        it('should throw error if specified reporter does not have "attachRunner" function', async () => {
            const FnReporter = createReporter(null);

            try {
                await initReporters([FnReporter], runner);
            } catch (e) {
                assert.equal(
                    e.message,
                    'Initialized reporter must have an "attachRunner" function for subscribe on test result events'
                );
            }
        });
    });

    it('should throw error if specified reporter has unsupported type', async () => {
        try {
            await initReporters([12345], runner);
        } catch (e) {
            assert.equal(e.message, 'Specified reporter must be a string, object or function, but got: "number"');
        }
    });
});
