import path from "path";
import {getStoryFile} from "@testplane/storybook"

export default {
    gridUrl: "http://localhost:4444/wd/hub",
    baseUrl: "http://localhost",
    pageLoadTimeout: 0,
    httpTimeout: 60000,
    testTimeout: 90000,
    resetCursor: false,
    // allows you to store references next to your story files
    screenshotsDir: (test) => {
        const storyFilePath = getStoryFile(test);
        const storyFileDirPath = path.dirname(storyFilePath);
        const storyFileName = path.basename(storyFilePath);
    
        return path.join(
            storyFileDirPath,
            `${storyFileName}-screens`,
            test.id,
            test.browserId
        );
    },
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
        // https://github.com/gemini-testing/testplane-storybook
        "@testplane/storybook": {},

        // https://github.com/gemini-testing/html-reporter
        "html-reporter/testplane": {
            enabled: true,
            path: "testplane-report",
            defaultView: "all",
            diffMode: "3-up-scaled"
        }
    }
};
