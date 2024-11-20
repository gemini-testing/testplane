import * as pirates from "pirates";
import sinon, { SinonStub } from "sinon";
import proxyquire from "proxyquire";
import { setupTransformHook, TRANSFORM_EXTENSIONS } from "../../../src/bundle/test-transformer";

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

        describe("'removeNonJsImports' option", () => {
            [true, false].forEach(removeNonJsImports => {
                describe(`should ${removeNonJsImports ? "" : "not "}remove non-js imports`, () => {
                    [".css", ".less", ".scss", ".jpg", ".png", ".woff"].forEach(extName => {
                        it(`asset with extension: "${extName}"`, () => {
                            let transformedCode;
                            const fileName = `some${extName}`;
                            (pirates.addHook as SinonStub).callsFake(cb => {
                                transformedCode = cb(`import "${fileName}"`, fileName);
                            });

                            setupTransformHook({ removeNonJsImports });

                            const expectedCode = ['"use strict";'];

                            if (!removeNonJsImports) {
                                expectedCode.push("", `require("some${extName}");`);
                            }

                            expectedCode.push("//# sourceMappingURL=");

                            assert.match(transformedCode, expectedCode.join("\n"));
                        });
                    });
                });
            });

            describe("should remove third party import with error from", () => {
                [".css", ".less", ".scss", ".sass", ".styl", ".stylus", ".pcss"].forEach(extName => {
                    it(`${extName} style file`, () => {
                        const moduleName = "some-module";
                        const error = { message: "Unexpected token {", stack: `foo${extName}:100500\nbar\nqux` };

                        const { setupTransformHook } = proxyquire("../../../src/bundle/test-transformer", {
                            "./cjs": proxyquire.noCallThru().load("../../../src/bundle/cjs/test-transformer", {
                                "../../utils/module": {
                                    requireModuleSync: sandbox.stub().withArgs(moduleName).throws(error),
                                },
                            }),
                        });

                        let transformedCode;

                        (pirates.addHook as SinonStub).callsFake(cb => {
                            transformedCode = cb(`import "${moduleName}"`, moduleName);
                        });

                        setupTransformHook({ removeNonJsImports: true });

                        assert.notMatch(transformedCode, new RegExp(`require\\("${moduleName}"\\)`));
                    });
                });
            });

            it("should not remove third party import with error not from style file", () => {
                const moduleName = "some-module";
                const error = { message: "Some error", stack: `foo.js:100500\nbar\nqux` };

                const { setupTransformHook } = proxyquire("../../../src/bundle/test-transformer", {
                    "./cjs": proxyquire.noCallThru().load("../../../src/bundle/cjs/test-transformer", {
                        "../../utils/module": {
                            requireModuleSync: sandbox.stub().withArgs(moduleName).throws(error),
                        },
                    }),
                });

                let transformedCode;

                (pirates.addHook as SinonStub).callsFake(cb => {
                    transformedCode = cb(`import "${moduleName}"`, moduleName);
                });

                setupTransformHook({ removeNonJsImports: true });

                assert.match(transformedCode, new RegExp(`require\\("${moduleName}"\\)`));
            });

            describe("replace import of esm module with a proxy", () => {
                const moduleName = "esm-module";
                const error = { message: "require() of ES Module", code: "ERR_REQUIRE_ESM" };
                const expectedProxyValue = [
                    `new Proxy({}, {`,
                    `  get: function (target, prop) {`,
                    `    return prop in target ? target[prop] : new Proxy(() => {}, this);`,
                    `  },`,
                    `  apply: function () {`,
                    `    return new Proxy(() => {}, this);`,
                    `  }`,
                    `});`,
                ].join("\n");

                let setupTransformHookStub!: typeof setupTransformHook;

                beforeEach(() => {
                    const { setupTransformHook } = proxyquire("../../../src/bundle/test-transformer", {
                        "./cjs": proxyquire.noCallThru().load("../../../src/bundle/cjs/test-transformer", {
                            "../../utils/module": {
                                requireModuleSync: sandbox.stub().withArgs(moduleName).throws(error),
                            },
                        }),
                    });
                    setupTransformHookStub = setupTransformHook;
                });

                it("should replace with default import", async () => {
                    let transformedCode;
                    (pirates.addHook as SinonStub).callsFake(cb => {
                        transformedCode = cb(`import pkg from "${moduleName}"`, moduleName);
                    });

                    setupTransformHookStub({ removeNonJsImports: true });

                    assert.match(transformedCode, `const pkg = ${expectedProxyValue}`);
                });

                it("should replace with namespace import", async () => {
                    let transformedCode;
                    (pirates.addHook as SinonStub).callsFake(cb => {
                        transformedCode = cb(`import * as pkg from "${moduleName}"`, moduleName);
                    });

                    setupTransformHookStub({ removeNonJsImports: true });

                    assert.match(transformedCode, `const pkg = ${expectedProxyValue}`);
                });

                it("should replace with property import", async () => {
                    let transformedCode;
                    (pirates.addHook as SinonStub).callsFake(cb => {
                        transformedCode = cb(`import {a, b as c} from "${moduleName}"`, moduleName);
                    });

                    setupTransformHookStub({ removeNonJsImports: true });

                    assert.match(transformedCode, `` + `const {\n` + `  a,\n` + `  c\n` + `} = ${expectedProxyValue}`);
                });
            });

            it("should not replace import of esm module with a proxy if it doesn't fail with 'ERR_REQUIRE_ESM' code", () => {
                const moduleName = "esm-module";
                const error = { message: "Some error" };

                const { setupTransformHook } = proxyquire("../../../src/bundle/test-transformer", {
                    "./cjs": proxyquire.noCallThru().load("../../../src/bundle/cjs/test-transformer", {
                        "../../utils/module": {
                            requireModuleSync: sandbox.stub().withArgs(moduleName).throws(error),
                        },
                    }),
                });

                let transformedCode;

                (pirates.addHook as SinonStub).callsFake(cb => {
                    transformedCode = cb(`import  "${moduleName}"`, moduleName);
                });

                setupTransformHook({ removeNonJsImports: true });

                assert.match(transformedCode, new RegExp(`require\\("${moduleName}"\\)`));
            });
        });
    });
});
