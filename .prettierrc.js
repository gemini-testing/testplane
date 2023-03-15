module.exports = {
    printWidth: 120,
    useTabs: false,
    tabWidth: 4,
    semi: true,
    singleQuote: false,
    trailingComma: "all",
    bracketSpacing: true,
    arrowParens: "avoid",
    overrides: [
        {
            // Trailing commas may break code in client-scripts that need to conform to the old ES standards
            files: "./src/browser/client-scripts/**",
            options: {
                trailingComma: "none",
            },
        },
    ],
};
