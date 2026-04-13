module.exports = {
    extends: ["gemini-testing", "plugin:@typescript-eslint/recommended", "prettier"],
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint"],
    root: true,
    parserOptions: {
        ecmaVersion: 2022,
    },
    overrides: [
        {
            files: ["src/browser/isomorphic/*.ts"],
            rules: {
                "@typescript-eslint/no-restricted-imports": [
                    "error",
                    {
                        patterns: ["../**"],
                    },
                ],
            },
        },
        {
            files: ["src/**/*.ts"],
            excludedFiles: ["src/browser/client-scripts/**"],
            rules: {
                "@typescript-eslint/no-restricted-imports": [
                    "error",
                    {
                        patterns: [
                            {
                                group: ["**/client-scripts/**"],
                                allowTypeImports: true,
                                message:
                                    "Imports from client-scripts are forbidden. Use type-only imports when needed.",
                            },
                        ],
                    },
                ],
            },
        },
        {
            files: ["src/browser/client-scripts/**/*.ts"],
            rules: {
                "@typescript-eslint/no-restricted-imports": [
                    "error",
                    {
                        patterns: [
                            {
                                group: ["../../**", "!../../isomorphic", "!../../isomorphic/**", "!../../..", "!../../../isomorphic", "!../../../isomorphic/**"],
                                message: "Client-scripts cannot import server-side code, except isomorphic modules.",
                            },
                        ],
                    },
                ],
            },
        },
        {
            files: ["*.ts"],
            rules: {
                "@typescript-eslint/explicit-function-return-type": "error",
                "@typescript-eslint/no-unsafe-declaration-merging": "off",
            },
        },
        {
            files: ["*.js"],
            rules: {
                "@typescript-eslint/no-var-requires": "off",
            },
        },
    ],
};
