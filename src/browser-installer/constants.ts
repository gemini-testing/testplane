export const CHROMEDRIVER_STORAGE_API = "https://chromedriver.storage.googleapis.com";

const CHROME_FOR_TESTING_VERSIONS_API_URL = "https://googlechromelabs.github.io/chrome-for-testing";
export const CHROME_FOR_TESTING_MILESTONES_API_URL = `${CHROME_FOR_TESTING_VERSIONS_API_URL}/latest-versions-per-milestone.json`;
export const CHROME_FOR_TESTING_LATEST_STABLE_API_URL = `${CHROME_FOR_TESTING_VERSIONS_API_URL}/LATEST_RELEASE_STABLE`;

export const GECKODRIVER_CARGO_TOML = "https://raw.githubusercontent.com/mozilla/geckodriver/release/Cargo.toml";

const FIREFOX_VERSIONS_VERSIONS_API_URL = "https://product-details.mozilla.org/1.0";
export const FIREFOX_VERSIONS_ALL_VERSIONS_API_URL = `${FIREFOX_VERSIONS_VERSIONS_API_URL}/firefox.json`;
export const FIREFOX_VERSIONS_LATEST_VERSIONS_API_URL = `${FIREFOX_VERSIONS_VERSIONS_API_URL}/firefox_versions.json`;

export const MSEDGEDRIVER_API = "https://msedgedriver.azureedge.net";

export const SAFARIDRIVER_PATH = "/usr/bin/safaridriver";
export const MIN_CHROME_FOR_TESTING_VERSION = 113;
export const MIN_CHROMEDRIVER_FOR_TESTING_VERSION = 115;
export const MIN_CHROMEDRIVER_MAC_ARM_NEW_ARCHIVE_NAME = 106;
export const MIN_CHROMIUM_MAC_ARM_VERSION = 93;
export const MIN_CHROMIUM_VERSION = 73;
export const MIN_FIREFOX_VERSION = 60;
export const MIN_EDGEDRIVER_VERSION = 94;
export const DRIVER_WAIT_TIMEOUT = 10 * 1000; // 10s
export const LINUX_UBUNTU_RELEASE_ID = "ubuntu";
export const LINUX_RUNTIME_LIBRARIES_PATH_ENV_NAME = "LD_LIBRARY_PATH";
export const MANDATORY_UBUNTU_PACKAGES_TO_BE_INSTALLED = ["fontconfig", "bzip2", "xz-utils"];
