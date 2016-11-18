'use strict';

exports.configOverriding =
`  Overriding config
    To override any config option use full option path converted to --kebab-case

    Examples:
      hermione --system-debug true
      hermione --base-url http://example.com
      hermione --browsers-firefox-sessions-per-browser 10

    You can also use environment variables converted to snake_case with
    hermione_ prefix

    Examples:
      hermione_system_debug=true hermione
      hermione_base_url=http://example.com hermione
      hermione_browsers_firefox_sessions_per_browser=10 hermione

    If both cli option and environment variable are used, cli option takes precedence
`;
