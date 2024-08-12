"use strict";

import { TestplaneRunOpts } from ".";

export const configOverriding = (opts: TestplaneRunOpts = {}): string => {
    const cliName = opts.cliName || "testplane";

    return `  Overriding config
    To override any config option use full option path converted to --kebab-case

    Examples:
      ${cliName} --system-debug true
      ${cliName} --base-url http://example.com
      ${cliName} --browsers-firefox-sessions-per-browser 10

    You can also use environment variables converted to snake_case with
    ${cliName}_ prefix

    Examples:
      ${cliName}_system_debug=true ${cliName}
      ${cliName}_base_url=http://example.com ${cliName}
      ${cliName}_browsers_firefox_sessions_per_browser=10 ${cliName}

    If both cli option and environment variable are used, cli option takes precedence
`;
};
