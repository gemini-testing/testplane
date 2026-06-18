"use strict";

const path = require("node:path");
const { spawn } = require("node:child_process");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const getPort = require("get-port");
const { runReplCommand, exitRepl } = require("./repl-client");

const ROOT_DIR = path.resolve(__dirname, "../../..");
const FIXTURE_DIR = path.join(__dirname, "fixture-project");
const TESTPLANE_BIN = path.join(ROOT_DIR, "bin", "testplane");
const CONFLICTING_ASYNC_LOADER = path.join(__dirname, "conflicting-async-loader.mjs");
const REPL_WAIT_TIMEOUT = 60000;
const EXIT_TIMEOUT = 60000;
const runningProcesses = new Set();

describe("REPL e2e", function () {
    this.timeout(180000);

    afterEach(() => {
        for (const childProcess of runningProcesses) {
            kill(childProcess);
        }

        runningProcesses.clear();
    });

    it("evaluates test and file scope variables from explicit switchToRepl", async () => {
        const testplane = await startTestplane(["--repl=true", "tests/switch-to-repl.test.ts"]);

        await runReplCommand(testplane.port, "const persistedValue = rootValue + localValue");
        const result = await runReplCommand(testplane.port, "persistedValue");
        await exitRepl(testplane.port);

        assert.equal(result, "1234");
        assert.equal(await testplane.waitForExit(), 0);
    });

    it("evaluates test and file scope variables before test body", async () => {
        const testplane = await startTestplane(["--repl-before-test=true", "tests/before-test.test.js"]);

        const result = await runReplCommand(testplane.port, "rootValue + localValue");
        await exitRepl(testplane.port);

        assert.equal(result, "1234");
        assert.equal(await testplane.waitForExit(), 0);
    });

    it("continues the test after exiting REPL", async () => {
        const testplane = await startTestplane(["--repl=true", "tests/switch-to-repl.test.ts"]);

        await exitRepl(testplane.port);

        assert.equal(await testplane.waitForExit(), 0);
    });

    it("runs browser commands from REPL", async () => {
        const testplane = await startTestplane(["--repl=true", "tests/switch-to-repl.test.ts"]);
        const command = [
            "await browser.url(pageUrl)",
            'await browser.$("#action").click()',
            'await browser.$("#message").getText()',
        ].join(", ");

        const result = await runReplCommand(testplane.port, command);
        await exitRepl(testplane.port);

        assert.equal(result, "'Clicked from fixture'");
        assert.equal(await testplane.waitForExit(), 0);
    });

    it("opens on fail with browser state from the failed test", async () => {
        const testplane = await startTestplane(["--repl-on-fail=true", "tests/on-fail.test.js"]);

        const result = await runReplCommand(testplane.port, 'await browser.$("#message").getText()');
        await exitRepl(testplane.port);

        assert.equal(result, "'Clicked from fixture'");
        assert.equal(await testplane.waitForExit(), 1);
    });
});

async function startTestplane(args) {
    const port = await getPort();
    const childProcess = spawn(
        process.execPath,
        [TESTPLANE_BIN, "--config", "testplane.config.js", "--local", "--repl-port", String(port), ...args],
        {
            cwd: FIXTURE_DIR,
            env: {
                ...process.env,
                FORCE_COLOR: "0",
                NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${pathToFileURL(CONFLICTING_ASYNC_LOADER).href}`]
                    .filter(Boolean)
                    .join(" "),
            },
            stdio: ["ignore", "pipe", "pipe"],
        },
    );
    const state = {
        output: "",
        exitCode: undefined,
        exitPromise: undefined,
    };

    childProcess.stdout.setEncoding("utf8");
    childProcess.stderr.setEncoding("utf8");
    runningProcesses.add(childProcess);
    childProcess.stdout.on("data", chunk => {
        state.output += chunk;
    });
    childProcess.stderr.on("data", chunk => {
        state.output += chunk;
    });
    childProcess.on("exit", code => {
        state.exitCode = code;
        runningProcesses.delete(childProcess);
    });

    await waitForRepl(childProcess, state, port);

    return {
        port,
        waitForExit: () => waitForExit(childProcess, state),
    };
}

function waitForRepl(childProcess, state, port) {
    return new Promise((resolve, reject) => {
        const readyMessage = `Port to connect to REPL from other terminals: ${port}`;
        let checkReady;
        let handleExit;
        let timeout;
        const cleanup = () => {
            clearTimeout(timeout);
            childProcess.stdout.off("data", checkReady);
            childProcess.stderr.off("data", checkReady);
            childProcess.off("exit", handleExit);
        };

        checkReady = () => {
            if (state.output.includes(readyMessage)) {
                cleanup();
                resolve();
            }
        };
        handleExit = code => {
            cleanup();
            reject(new Error(`Testplane exited with code ${code} before opening REPL\n\n${state.output}`));
        };

        timeout = setTimeout(() => {
            cleanup();
            kill(childProcess);
            reject(new Error(`Timed out waiting for REPL on port ${port}\n\n${state.output}`));
        }, REPL_WAIT_TIMEOUT);

        childProcess.stdout.on("data", checkReady);
        childProcess.stderr.on("data", checkReady);
        childProcess.on("exit", handleExit);
        checkReady();
    });
}

function waitForExit(childProcess, state) {
    if (state.exitCode !== undefined) {
        return Promise.resolve(state.exitCode);
    }

    if (!state.exitPromise) {
        state.exitPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                kill(childProcess);
                reject(new Error(`Timed out waiting for Testplane exit\n\n${state.output}`));
            }, EXIT_TIMEOUT);

            childProcess.once("exit", code => {
                clearTimeout(timeout);
                resolve(code);
            });
        });
    }

    return state.exitPromise;
}

function kill(childProcess) {
    if (!childProcess.killed) {
        childProcess.kill("SIGTERM");
    }
}
