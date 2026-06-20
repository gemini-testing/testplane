import { Command } from "@gemini-testing/commander";

export const addReplOptions = (cmd: Command): Command => {
    return cmd
        .option(
            "--repl [type]",
            "run one test, call `browser.switchToRepl` in test code to open repl interface",
            Boolean,
            false,
        )
        .option("--repl-before-test [type]", "open repl interface before test run", Boolean, false)
        .option("--repl-on-fail [type]", "open repl interface on test fail only", Boolean, false)
        .option(
            "--repl-port <number>",
            "run net server on port to exchange messages with repl (used free random port by default)",
            Number,
            0,
        );
};

export const isReplModeEnabled = (program: Command): boolean => {
    return Boolean(program.repl || program.replBeforeTest || program.replOnFail);
};
