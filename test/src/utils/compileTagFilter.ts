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

            assert.isTrue(func(new Map(okTags.map(tag => [tag, false]))));

            assert.isFalse(func(new Map(badTags.map(tag => [tag, false]))));
        });
    });

    it("check injection code", () => {
        const injectionStr = '")+console.log("111111';
        const func = compileTagFilter(injectionStr);

        assert.isFalse(func(new Map()));
    });
});
