import * as pirates from "pirates";
import sinon, { SinonStub } from "sinon";
import { setupTransformHook, TRANSFORM_EXTENSIONS } from "../../../src/test-reader/test-transformer";

describe("test-transformer", () => {
    const sandbox = sinon.createSandbox();

    beforeEach(() => {
        sandbox.stub(pirates, "addHook").returns(sandbox.stub());
    });

    afterEach(() => sandbox.restore());

    describe("setupTransformHook", () => {
        it("should return function to revert transformation", () => {
            const revertFn = sandbox.stub();
            (pirates.addHook as SinonStub).returns(revertFn);

            assert.equal(setupTransformHook(), revertFn);
        });

        describe("should transform", () => {
            TRANSFORM_EXTENSIONS.forEach(extName => {
                it(`component with extension: "${extName}"`, () => {
                    let transformedCode;
                    (pirates.addHook as SinonStub).callsFake(cb => {
                        transformedCode = cb(`import "some${extName}"`);
                    });

                    setupTransformHook();

                    assert.exists(transformedCode, `require("some${extName}")`);
                });
            });

            it("modules without extension", () => {
                let transformedCode;
                (pirates.addHook as SinonStub).callsFake(cb => {
                    transformedCode = cb('import "some-module"');
                });

                setupTransformHook();

                assert.exists(transformedCode, 'require("some-module")');
            });

            it(".json", () => {
                let transformedCode;
                (pirates.addHook as SinonStub).callsFake(cb => {
                    transformedCode = cb('import "some.json"');
                });

                setupTransformHook();

                assert.exists(transformedCode, 'require("some.json")');
            });
        });

        describe("should not transform", () => {
            [".css", ".less", ".scss", ".jpg", ".png", ".woff"].forEach(extName => {
                it(`asset with extension: "${extName}"`, () => {
                    let transformedCode;
                    (pirates.addHook as SinonStub).callsFake(cb => {
                        transformedCode = cb(`import "some${extName}"`);
                    });

                    setupTransformHook();

                    assert.equal(transformedCode, '"use strict";');
                });
            });
        });
    });
});
