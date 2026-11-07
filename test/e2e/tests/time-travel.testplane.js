const assert = require("assert");
const fs = require("fs");
const path = require("path");
const initSqlJs = require("@gemini-testing/sql.js");
const yauzl = require("yauzl");

const REPORT_PATH = path.resolve(__dirname, "../static/basic-report");
const TEST_NAME = "keeps steps aligned after delayed rrweb installation on navigation";

const readSnapshots = zipPath =>
    new Promise((resolve, reject) => {
        yauzl.open(zipPath, { lazyEntries: true }, (openError, zipFile) => {
            if (openError) {
                reject(openError);
                return;
            }

            const rejectAndClose = error => {
                zipFile.close();
                reject(error);
            };

            zipFile.readEntry();
            zipFile.on("entry", entry => {
                if (entry.fileName !== "snapshots.json") {
                    zipFile.readEntry();
                    return;
                }

                zipFile.openReadStream(entry, (streamError, stream) => {
                    if (streamError) {
                        rejectAndClose(streamError);
                        return;
                    }

                    const chunks = [];

                    stream.on("data", chunk => chunks.push(chunk));
                    stream.on("error", rejectAndClose);
                    stream.on("end", () => {
                        try {
                            const snapshots = Buffer.concat(chunks)
                                .toString()
                                .split("\n")
                                .filter(Boolean)
                                .map(line => JSON.parse(line));

                            zipFile.close();
                            resolve(snapshots);
                        } catch (error) {
                            rejectAndClose(error);
                        }
                    });
                });
            });
            zipFile.on("end", () => rejectAndClose(new Error('snapshot archive does not contain "snapshots.json"')));
            zipFile.on("error", rejectAndClose);
        });
    });

const findNode = (node, predicate) => {
    if (predicate(node)) {
        return node;
    }

    for (const child of node.childNodes || []) {
        const result = findNode(child, predicate);

        if (result) {
            return result;
        }
    }

    return null;
};

const isInsideStep = (timestamp, step) => timestamp >= step.ts && timestamp <= step.ts + step.d;

describe("time travel report", () => {
    it("keeps delayed navigation DOM events aligned with named steps", async () => {
        const SQL = await initSqlJs({
            locateFile: file => require.resolve(`@gemini-testing/sql.js/dist/${file}`),
        });
        const database = new SQL.Database(fs.readFileSync(path.join(REPORT_PATH, "sqlite.db")));
        const statement = database.prepare("SELECT history, attachments FROM suites WHERE suiteName = ?");

        statement.bind([TEST_NAME]);
        assert(statement.step(), `test result "${TEST_NAME}" is missing from the generated report`);

        const reportEntry = statement.getAsObject();
        const history = JSON.parse(reportEntry.history);
        const attachments = JSON.parse(reportEntry.attachments);

        statement.free();
        database.close();

        const snapshotAttachment = attachments.find(attachment => attachment.type === 0);

        assert(snapshotAttachment, "Time Travel snapshot attachment is missing from the generated report");

        const snapshots = await readSnapshots(path.join(REPORT_PATH, snapshotAttachment.path));
        const openStep = history.find(step => step.n === "Open delayed page");
        const fillStep = history.find(step => step.n === "Fill delayed input");

        assert(openStep, 'history step "Open delayed page" is missing');
        assert(fillStep, 'history step "Fill delayed input" is missing');

        const delayedPageSnapshot = snapshots.find(snapshot => {
            if (snapshot.type !== 2 || !isInsideStep(snapshot.timestamp, openStep)) {
                return false;
            }

            const title = findNode(snapshot.data.node, node => node.tagName === "title");
            const input = findNode(
                snapshot.data.node,
                node => node.tagName === "input" && node.attributes?.id === "value",
            );

            return title?.childNodes?.[0]?.textContent === "Time Travel delayed rrweb installation" && input;
        });

        assert(delayedPageSnapshot, 'the delayed page full snapshot is not aligned with "Open delayed page"');

        const input = findNode(
            delayedPageSnapshot.data.node,
            node => node.tagName === "input" && node.attributes?.id === "value",
        );

        assert.strictEqual(input.attributes.value, "", 'input must be empty at the end of "Open delayed page"');

        const filledInputEvent = snapshots.find(
            snapshot => snapshot.data?.source === 5 && snapshot.data.text === "after-delay",
        );

        assert(filledInputEvent, 'input mutation "after-delay" is missing from Time Travel snapshots');
        assert(
            isInsideStep(filledInputEvent.timestamp, fillStep),
            'input mutation "after-delay" is not aligned with "Fill delayed input"',
        );
    });
});
