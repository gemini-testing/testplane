"use strict";

const net = require("node:net");

const HOST = "127.0.0.1";
const PROMPT = "> ";
const SERVER_CLOSED_MESSAGE = "The server was closed after the REPL was exited";
const TIMEOUT = 30000;

exports.runReplCommand = async (port, code) => {
    const socket = await connect(port);

    return new Promise((resolve, reject) => {
        let output = "";

        const timeout = setTimeout(() => {
            socket.destroy();
            reject(new Error(`Timed out after ${TIMEOUT}ms waiting for REPL result`));
        }, TIMEOUT);

        socket.setEncoding("utf8");
        socket.write(`${code}\n`);
        socket.on("data", chunk => {
            output += chunk;

            if (output.endsWith(PROMPT)) {
                clearTimeout(timeout);
                socket.end();
                resolve(extractResult(output));
            }
        });
        socket.on("error", err => {
            clearTimeout(timeout);
            reject(err);
        });
    });
};

exports.exitRepl = async port => {
    const socket = await connect(port);

    return new Promise((resolve, reject) => {
        let output = "";
        let isDone = false;
        const timeout = setTimeout(() => {
            socket.destroy();
            reject(new Error(`Timed out after ${TIMEOUT}ms waiting for REPL exit`));
        }, TIMEOUT);
        const done = () => {
            if (isDone) {
                return;
            }

            isDone = true;
            clearTimeout(timeout);
            socket.destroy();
            resolve();
        };

        socket.setEncoding("utf8");
        socket.write(".exit\n");
        socket.on("data", chunk => {
            output += chunk;

            if (output.includes(SERVER_CLOSED_MESSAGE)) {
                done();
            }
        });
        socket.on("close", done);
        socket.on("error", err => {
            if (isDone) {
                return;
            }

            isDone = true;
            clearTimeout(timeout);
            reject(err);
        });
    });
};

function connect(port) {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
        const tryConnect = () => {
            const socket = net.createConnection({ host: HOST, port });

            socket.once("connect", () => resolve(socket));
            socket.once("error", err => {
                socket.destroy();

                if (Date.now() - startTime >= TIMEOUT) {
                    reject(err);
                    return;
                }

                setTimeout(tryConnect, 100);
            });
        };

        tryConnect();
    });
}

function extractResult(rawOutput) {
    let result = rawOutput;

    if (result.startsWith(PROMPT)) {
        result = result.slice(PROMPT.length);
    }

    if (result.endsWith(PROMPT)) {
        result = result.slice(0, -PROMPT.length);
    }

    return result.replace(/\n$/, "");
}

if (require.main === module) {
    const [, , portArg, ...codeParts] = process.argv;
    const port = Number(portArg);

    if (!Number.isInteger(port) || codeParts.length === 0) {
        console.error("Usage: node repl-client.js <port> <code>");
        process.exit(1);
    }

    exports
        .runReplCommand(port, codeParts.join(" "))
        .then(result => process.stdout.write(result))
        .catch(err => {
            console.error(err.message);
            process.exit(1);
        });
}
