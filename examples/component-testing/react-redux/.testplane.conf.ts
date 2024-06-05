export default {
    baseUrl: "http://localhost",
    automationProtocol: "devtools",
    sessionsPerBrowser: 1,
    testsPerSession: 10,
    windowSize: "1280x1024",
    system: {
        workers: 1,
        testRunEnv: ["browser", {viteConfig: "./vite.config.ts"}]
    },
    sets: {
        linux: {
            files: [
                "src/tests/**/*.testplane.tsx"
            ],
            browsers: [
                "linux-chrome"
            ]
        },
    },
    browsers: {
        "linux-chrome": {
            desiredCapabilities: {
                browserName: "chrome"
            }
        }
    },
    plugins: {
        "html-reporter/hermione": {
            enabled: true,
            path: "hermione-report",
            defaultView: "all",
            diffMode: "3-up-scaled"
        }
    }
};
