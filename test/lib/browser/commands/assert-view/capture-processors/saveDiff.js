'use strict';

const {saveDiff} = require('lib/browser/commands/assert-view/capture-processors/save-diff');
const fs = require('fs-extra');
const {Image} = require('gemini-core');

const curPath = '/curPath.png';
const refPath = '/refPath.png';
const diffPath = '/diffPath.png';
const diffOpts = {
    foo: 'bar'
};
const diffBuffer = Buffer.from('foobar');

describe('browser/commands/assert-view/capture-processors/save-diff', () => {
    const sandbox = sinon.createSandbox();
    let cache;

    beforeEach(() => {
        cache = new Map();

        sandbox.stub(fs, 'readFile');
        sandbox.stub(fs, 'writeFile');
        sandbox.stub(Image, 'buildDiff').resolves(diffBuffer);

        fs.readFile.withArgs(curPath).resolves(Buffer.from('currentContent'));
        fs.readFile.withArgs(refPath).resolves(Buffer.from('referenceContent'));
    });

    afterEach(() => sandbox.restore());

    it('should get result from cache for second call if data not changed', async () => {
        await saveDiff(curPath, refPath, '/firstDiffPath.png', diffOpts, cache);
        const result = await saveDiff(curPath, refPath, diffPath, diffOpts, cache);

        assert.strictEqual(result, '/firstDiffPath.png');
        assert.calledOnceWith(
            Image.buildDiff,
            sinon.match({
                foo: 'bar',
                current: Buffer.from('currentContent'),
                reference: Buffer.from('referenceContent')
            })
        );
        assert.calledOnceWith(
            fs.writeFile,
            sinon.match('/firstDiffPath.png'),
            sinon.match(diffBuffer)
        );
    });

    it('should build diff for second call if current image changed ', async () => {
        await saveDiff(curPath, refPath, 'firstDiffPath', diffOpts, cache);

        fs.readFile.withArgs(curPath).resolves(Buffer.from('changedCurrentContent'));

        const result = await saveDiff(curPath, refPath, diffPath, diffOpts, cache);

        assert.strictEqual(result, diffPath);
        assert.calledTwice(Image.buildDiff);
        assert.calledWith(
            Image.buildDiff,
            sinon.match({
                foo: 'bar',
                current: Buffer.from('changedCurrentContent'),
                reference: Buffer.from('referenceContent')
            })
        );
        assert.calledTwice(fs.writeFile);
        assert.calledWith(
            fs.writeFile,
            sinon.match(diffPath),
            sinon.match(diffBuffer)
        );
    });

    it('should build diff for second call if reference image changed ', async () => {
        await saveDiff(curPath, refPath, 'firstDiffPath', diffOpts, cache);

        fs.readFile.withArgs(refPath).resolves(Buffer.from('changedReferenceContent'));

        const result = await saveDiff(curPath, refPath, diffPath, diffOpts, cache);

        assert.strictEqual(result, diffPath);
        assert.calledTwice(Image.buildDiff);
        assert.calledWith(
            Image.buildDiff,
            sinon.match({
                foo: 'bar',
                current: Buffer.from('currentContent'),
                reference: Buffer.from('changedReferenceContent')
            })
        );
        assert.calledTwice(fs.writeFile);
        assert.calledWith(
            fs.writeFile,
            sinon.match(diffPath),
            sinon.match(diffBuffer)
        );
    });
});
