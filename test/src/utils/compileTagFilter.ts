import { compileTagFilter } from "../../../src/utils/cli";

describe("compileTagFilter", () => {
    it("should work with correct expression string", () => {
        const cases = [
            {
                expression: "old&smoke",
                okTags: ["smoke", "desktop", "old"],
                badTags: ["old"],
            },
            {
                expression: "old&smoke|desktop",
                okTags: ["smoke", "desktop", "old"],
                badTags: ["smoke", "slow"],
            },
            {
                expression: "old",
                okTags: ["smoke", "desktop", "old"],
                badTags: ["smoke", "desktop"],
            },
            {
                expression: "!slow",
                okTags: ["smoke", "desktop", "old"],
                badTags: ["slow"],
            },
        ];

        cases.forEach(({ expression, okTags, badTags }) => {
            const func = compileTagFilter(expression);

            assert.isTrue(func(new Set(okTags.map(tag => tag))));

            assert.isFalse(func(new Set(badTags.map(tag => tag))));
        });
    });

    it("should match tags with the same case as in the expression", () => {
        const cases = [
            { expression: "Smoke", okTags: ["Smoke"], badTags: ["smoke"] },
            { expression: "!Slow", okTags: ["slow", "Payments"], badTags: ["Slow", "Payments"] },
            { expression: "Payments&Slow", okTags: ["Slow", "Payments"], badTags: ["slow", "payments"] },
        ];

        cases.forEach(({ expression, okTags, badTags }) => {
            const func = compileTagFilter(expression);

            assert.isTrue(func(new Set(okTags)));

            assert.isFalse(func(new Set(badTags)));
        });
    });

    it("check injection code", () => {
        const injectionStr = '")+console.log("111111';
        const func = compileTagFilter(injectionStr);

        assert.isFalse(func(new Set()));
    });
});
