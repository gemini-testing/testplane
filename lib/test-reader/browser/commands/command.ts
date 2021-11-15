import type { Test } from "../../../types/mocha";

export default abstract class BaseCommand {
    abstract execute(version: string): void;

    abstract handleTest(test: Test): void;

    abstract handleSuite(): void;
};
