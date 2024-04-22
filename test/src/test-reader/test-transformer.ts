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
                    const fileName = `some${extName}`;
                    (pirates.addHook as SinonStub).callsFake(cb => {
                        transformedCode = cb(`import "${fileName}"`, fileName);
                    });

                    setupTransformHook();

                    assert.match(transformedCode, `require("${fileName}")`);
                });
            });

            it("modules without extension", () => {
                let transformedCode;
                const moduleName = "some-module";
                (pirates.addHook as SinonStub).callsFake(cb => {
                    transformedCode = cb(`import "${moduleName}"`, moduleName);
                });

                setupTransformHook();

                assert.match(transformedCode, 'require("some-module")');
            });

            it(".json", () => {
                let transformedCode;
                const fileName = "some.json";
                (pirates.addHook as SinonStub).callsFake(cb => {
                    transformedCode = cb(`import "${fileName}"`, fileName);
                });

                setupTransformHook();

                assert.match(transformedCode, `require("${fileName}")`);
            });
        });

        describe("should not transform", () => {
            [".css", ".less", ".scss", ".jpg", ".png", ".woff"].forEach(extName => {
                it(`asset with extension: "${extName}"`, () => {
                    let transformedCode;
                    const fileName = `some${extName}`;
                    (pirates.addHook as SinonStub).callsFake(cb => {
                        transformedCode = cb(`import "${fileName}"`, fileName);
                    });

                    setupTransformHook();

                    assert.equal(transformedCode, '"use strict";');
                });
            });
        });
    });
});
