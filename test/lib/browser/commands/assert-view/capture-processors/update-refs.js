'use strict';

const {EventEmitter} = require('events');
const _ = require('lodash');
const Promise = require('bluebird');
const fs = require('fs-extra');
const {UPDATE_REFERENCE} = require('lib/worker/constants/runner-events');
const {handleNoRefImage, handleImageDiff} = require('lib/browser/commands/assert-view/capture-processors/update-refs');

describe('browser/commands/assert-view/capture-processors/update-refs', () => {
    const sandbox = sinon.createSandbox();

    const callHandler_ = (handler, opts) => {
        const {currImg, refImg, state, emitter} = _.defaultsDeep(opts, {
            currImg: {path: '/default-curr/path'},
            refImg: {path: '/default-ref/path'},
            state: 'default-state',
            emitter: new EventEmitter()
        });

        return handler(currImg, refImg, state, {emitter});
    };

    beforeEach(() => {
        sandbox.stub(fs, 'copy').resolves();
    });

    afterEach(() => {
        sandbox.restore();
    });

    [
        {name: 'handleNoRefImage', handler: handleNoRefImage},
        {name: 'handleImageDiff', handler: handleImageDiff}
    ].forEach(({name, handler}) => {
        describe(`${name}`, () => {
            it('should update reference image by a current image', async () => {
                await callHandler_(handler, {
                    currImg: {path: '/curr/path'},
                    refImg: {path: '/ref/path'}
                });

                assert.calledOnceWith(fs.copy, '/curr/path', '/ref/path');
            });

            it(`should emit "${UPDATE_REFERENCE}" event with state and image data`, async () => {
                const emitter = new EventEmitter();
                const onUpdateReference = sandbox.spy().named('onUpdateReference');

                emitter.on(UPDATE_REFERENCE, onUpdateReference);

                await callHandler_(handler, {
                    refImg: {path: '/ref/path'},
                    state: 'some-state',
                    emitter
                });

                assert.calledOnceWith(onUpdateReference, {refImg: {path: '/ref/path'}, state: 'some-state'});
            });

            it(`should emit "${UPDATE_REFERENCE}" only after the reference image has been updated`, async () => {
                const emitter = new EventEmitter();
                const onUpdateReference = sandbox.spy().named('onUpdateReference');
                fs.copy.callsFake(() => Promise.delay(10).then(Promise.resolve));

                emitter.on(UPDATE_REFERENCE, onUpdateReference);

                await callHandler_(handler, {emitter});

                assert.callOrder(fs.copy, onUpdateReference);
            });
        });
    });
});
