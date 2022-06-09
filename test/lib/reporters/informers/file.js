const fs = require('fs');
const chalk = require('chalk');
const logger = require('lib/utils/logger');
const FileInformer = require('lib/reporters/informers/file');

describe('reporter/informers/file', () => {
    const sandbox = sinon.sandbox.create();
    let fsStream;

    beforeEach(() => {
        fsStream = {write: sandbox.stub(), end: sandbox.stub()};
        sandbox.stub(fs, 'createWriteStream').returns(fsStream);

        sandbox.stub(logger, 'log');
    });

    afterEach(() => sandbox.restore());

    it('should create write stream to passed file path', () => {
        FileInformer.create({path: './some-path/file.txt'});

        assert.calledOnceWith(fs.createWriteStream, './some-path/file.txt');
    });

    it('should inform user that test results will be saved to a file', () => {
        const opts = {type: 'flat', path: './some-path/file.txt'};

        FileInformer.create(opts);

        assert.calledOnceWith(
            logger.log,
            `Information with test results for report: "${opts.type}" will be saved to a file: "${opts.path}"`
        );
    });

    ['log', 'warn', 'error'].forEach((methodName) => {
        describe(`"${methodName}" method`, () => {
            it('should stringify object message before write it to a file', () => {
                const message = {foo: 'bar'};

                FileInformer.create({type: 'flat', path: './file.txt'})[methodName](message);

                assert.calledOnceWith(fsStream.write, `${JSON.stringify(message)}\n`);
            });

            it('should remove color from string message before write it to a file', () => {
                const message = chalk.red('some message');

                FileInformer.create({type: 'flat', path: './file.txt'})[methodName](message);

                assert.calledOnceWith(fsStream.write, 'some message\n');
            });
        });
    });

    describe('"end" method', () => {
        it('should stringify object message before write it to a file', () => {
            const message = {foo: 'bar'};

            FileInformer.create({type: 'flat', path: './file.txt'}).end(message);

            assert.calledOnceWith(fsStream.end, `${JSON.stringify(message)}\n`);
        });

        it('should remove color from string message before write it to a file', () => {
            const message = chalk.red('some message');

            FileInformer.create({type: 'flat', path: './file.txt'}).end(message);

            assert.calledOnceWith(fsStream.end, 'some message\n');
        });

        it('should call without args if message is not passed', () => {
            FileInformer.create({type: 'flat', path: './file.txt'}).end();

            assert.calledOnceWithExactly(fsStream.end);
        });
    });
});
