"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MANDATORY_UBUNTU_PACKAGES_TO_BE_INSTALLED = exports.LINUX_RUNTIME_LIBRARIES_PATH_ENV_NAME = exports.LINUX_UBUNTU_RELEASE_ID = exports.DRIVER_WAIT_TIMEOUT = exports.MIN_EDGEDRIVER_VERSION = exports.MIN_FIREFOX_VERSION = exports.MIN_CHROMIUM_VERSION = exports.MIN_CHROMIUM_MAC_ARM_VERSION = exports.MIN_CHROMEDRIVER_MAC_ARM_NEW_ARCHIVE_NAME = exports.MIN_CHROMEDRIVER_FOR_TESTING_VERSION = exports.MIN_CHROME_FOR_TESTING_VERSION = exports.SAFARIDRIVER_PATH = exports.MSEDGEDRIVER_API = exports.FIREFOX_VERSIONS_LATEST_VERSIONS_API_URL = exports.FIREFOX_VERSIONS_ALL_VERSIONS_API_URL = exports.GECKODRIVER_CARGO_TOML = exports.CHROME_FOR_TESTING_LATEST_STABLE_API_URL = exports.CHROME_FOR_TESTING_MILESTONES_API_URL = exports.CHROMEDRIVER_STORAGE_API = void 0;
exports.CHROMEDRIVER_STORAGE_API = "https://chromedriver.storage.googleapis.com";
const CHROME_FOR_TESTING_VERSIONS_API_URL = "https://googlechromelabs.github.io/chrome-for-testing";
exports.CHROME_FOR_TESTING_MILESTONES_API_URL = `${CHROME_FOR_TESTING_VERSIONS_API_URL}/latest-versions-per-milestone.json`;
exports.CHROME_FOR_TESTING_LATEST_STABLE_API_URL = `${CHROME_FOR_TESTING_VERSIONS_API_URL}/LATEST_RELEASE_STABLE`;
exports.GECKODRIVER_CARGO_TOML = "https://raw.githubusercontent.com/mozilla/geckodriver/release/Cargo.toml";
const FIREFOX_VERSIONS_VERSIONS_API_URL = "https://product-details.mozilla.org/1.0";
exports.FIREFOX_VERSIONS_ALL_VERSIONS_API_URL = `${FIREFOX_VERSIONS_VERSIONS_API_URL}/firefox.json`;
exports.FIREFOX_VERSIONS_LATEST_VERSIONS_API_URL = `${FIREFOX_VERSIONS_VERSIONS_API_URL}/firefox_versions.json`;
exports.MSEDGEDRIVER_API = "https://msedgedriver.azureedge.net";
exports.SAFARIDRIVER_PATH = "/usr/bin/safaridriver";
exports.MIN_CHROME_FOR_TESTING_VERSION = 113;
exports.MIN_CHROMEDRIVER_FOR_TESTING_VERSION = 115;
exports.MIN_CHROMEDRIVER_MAC_ARM_NEW_ARCHIVE_NAME = 106;
exports.MIN_CHROMIUM_MAC_ARM_VERSION = 93;
exports.MIN_CHROMIUM_VERSION = 73;
exports.MIN_FIREFOX_VERSION = 60;
exports.MIN_EDGEDRIVER_VERSION = 94;
exports.DRIVER_WAIT_TIMEOUT = 10 * 1000; // 10s
exports.LINUX_UBUNTU_RELEASE_ID = "ubuntu";
exports.LINUX_RUNTIME_LIBRARIES_PATH_ENV_NAME = "LD_LIBRARY_PATH";
exports.MANDATORY_UBUNTU_PACKAGES_TO_BE_INSTALLED = ["fontconfig"];
//# sourceMappingURL=constants.js.map