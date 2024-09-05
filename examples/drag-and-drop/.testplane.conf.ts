const SERVER_PORT = process.env.PORT || 3000;

export default {
    gridUrl: "http://localhost:4444/wd/hub",
    baseUrl: `http://localhost:${SERVER_PORT}`,
    pageLoadTimeout: 0,
    httpTimeout: 60000,
    testTimeout: 90000,
    resetCursor: false,
    sets: {
        desktop: {
            files: [
                "testplane-tests/**/*.testplane.(t|j)s"
            ],
            browsers: [
                "chrome"
            ]
        }
    },
    browsers: {
        chrome: {
            automationProtocol: "devtools",
            headless: true,
            desiredCapabilities: {
                browserName: "chrome"
            }
        }
    },
    plugins: {
        "html-reporter/testplane": {
            // https://github.com/gemini-testing/html-reporter
            enabled: true,
            path: "testplane-report",
            defaultView: "all",
            diffMode: "3-up-scaled"
        }
    },
    devServer: {
        command: "npm run server:dev",
        env: { PORT: SERVER_PORT }
    },
};
