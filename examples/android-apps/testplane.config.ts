export default {
    gridUrl: "http://localhost:4444",
    baseUrl: "http://localhost",
    pageLoadTimeout: 0,
    httpTimeout: 60000,
    testTimeout: 90000,
    resetCursor: false,
    sets: {
        web: {
            files: [
                "testplane-tests/web-app/**/*.testplane.(t|j)s"
            ],
            browsers: [
                "web.chrome",
            ]
        },
        native: {
            files: [
                "testplane-tests/native-app/**/*.testplane.(t|j)s"
            ],
            browsers: [
                "native.clock",
            ]
        },
        hybrid: {
            files: [
                "testplane-tests/hybrid-app/**/*.testplane.(t|j)s"
            ],
            browsers: [
                "hybrid.chrome",
            ]
        }
    },
    browsers: {
        "web.chrome": {
            desiredCapabilities: {
                browserName: "chrome",
                "appium:automationName": "UiAutomator2",
                "appium:platformName": "android",
            }
        },
        "native.clock": {
            desiredCapabilities: {
                "appium:appPackage": "com.google.android.deskclock",
                "appium:appActivity": "com.google.android.deskclock/com.android.deskclock.DeskClock",
                "appium:automationName": "UiAutomator2",
                "appium:platformName": "android",
            }
        },
        "hybrid.chrome": {
            desiredCapabilities: {
                "appium:appPackage": "com.android.chrome",
                "appium:appActivity": "com.google.android.apps.chrome.Main",
                "appium:automationName": "UiAutomator2",
                "appium:platformName": "android",
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
    system: {
        debug: true,
        parallelLimit: 1,
    }
};
