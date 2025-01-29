import { inspect } from "node:util";

const secretPatterns = {
    BEARER_TOKEN: /Bearer [A-Za-z0-9-._~+/]{30,}/gi,
    OAUTH_KEY: /OAuth [A-Za-z0-9-._~+/]{30,}/gi,
    OAUTH_TOKEN: /oauth_token=[A-Za-z0-9-._~+/]{30,}/g,
    OAUTH_ACCESS_TOKEN: /access_token=[A-Za-z0-9-._~+/]{30,}/g,
    JWT_TOKEN: /ey[A-Za-z0-9=_-]+\.[A-Za-z0-9=_-]+\.[A-Za-z0-9=_-]*/g,
    AWS_ACCESS_KEY: /AKIA[A-Z0-9]{16}/g,
    GOOGLE_CLOUD_SECRET_KEY: /AIza[a-zA-Z0-9]{35}/g,
    STRIPE_LIVE_API_KEY: /sk_live_[a-zA-Z0-9]{24}/g,
    STRIPE_TEST_API_KEY: /sk_test_[a-zA-Z0-9]{24}/g,
    GITHUB_PAGES_ACCESS_TOKEN: /ghp_[a-zA-Z0-9]{36}/g,
    SLACK_API_TOKEN: /xox[baprs]-[a-zA-Z0-9]{12,}/g,
    REFRESH_TOKEN: /refresh_token_[a-zA-Z0-9-_]{32,}/g,
    SESSION_ID: /sess_[a-zA-Z0-9-_]{22,}/g,
} as const;

export const hideSecrets = (source: string): string => {
    return Object.keys(secretPatterns).reduce((result, patternName) => {
        const pattern = secretPatterns[patternName as keyof typeof secretPatterns];

        return result.replaceAll(pattern, `<${patternName}>`);
    }, source);
};

export const utilInspectSafe = <T>(obj: T): string => hideSecrets(inspect(obj));
