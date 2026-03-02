import { SelectivityMode } from "src/config/types";
import {
    selectivityIsDisabled,
    selectivityShouldWrite,
    selectivityShouldRead,
} from "src/browser/cdp/selectivity/modes";

describe("CDP/Selectivity/Modes", () => {
    describe("selectivityIsDisabled", () => {
        [
            { mode: SelectivityMode.Disabled, expected: true },
            { mode: SelectivityMode.Enabled, expected: false },
            { mode: SelectivityMode.ReadOnly, expected: false },
            { mode: SelectivityMode.WriteOnly, expected: false },
        ].forEach(({ mode, expected }) => {
            it(`should return ${expected} when mode is ${mode}`, () => {
                assert.equal(selectivityIsDisabled(mode), expected);
            });
        });
    });

    describe("selectivityShouldWrite", () => {
        [
            { mode: SelectivityMode.Enabled, expected: true },
            { mode: SelectivityMode.WriteOnly, expected: true },
            { mode: SelectivityMode.Disabled, expected: false },
            { mode: SelectivityMode.ReadOnly, expected: false },
        ].forEach(({ mode, expected }) => {
            it(`should return ${expected} when mode is ${mode}`, () => {
                assert.equal(selectivityShouldWrite(mode), expected);
            });
        });
    });

    describe("selectivityShouldRead", () => {
        [
            { mode: SelectivityMode.Enabled, expected: true },
            { mode: SelectivityMode.ReadOnly, expected: true },
            { mode: SelectivityMode.Disabled, expected: false },
            { mode: SelectivityMode.WriteOnly, expected: false },
        ].forEach(({ mode, expected }) => {
            it(`should return ${expected} when mode is ${mode}`, () => {
                assert.equal(selectivityShouldRead(mode), expected);
            });
        });
    });
});
