interface UnhandledRejectionErrorDetails {
    testsHint: string;
    workerPid?: number;
    error: Error;
}

export class UnhandledRejectionError extends Error {
    constructor(details: UnhandledRejectionErrorDetails) {
        const lines: Array<string> = [];
        lines.push("This run has been terminated due to an unhandled promise rejection.\n");

        lines.push("What happened:");
        lines.push("- A promise rejected without being handled");

        lines.push("What you can do:");
        lines.push('- Analyze error below and check your tests for missing "await" statements');
        lines.push(
            "- Turn on the @typescript-eslint/no-floating-promises rule to catch\n" +
                '  missing "await" statements automatically (works even for js files!)',
        );

        if (details.testsHint) {
            lines.push(`\nThe error most likely originated from one of the tests below.\n${details.testsHint}`);
        }

        lines.push(`\nError details: ${details.error.message}\n${details.error.stack}`);

        super(lines[0]);
        this.stack = lines.join("\n");
        this.name = "UnhandledRejectionTerminatedError";
    }
}
