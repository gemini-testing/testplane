import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
    stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
    addons: [
        "@storybook/addon-onboarding",
        "@storybook/addon-links",
        "@storybook/addon-docs",
        "@storybook/addon-controls",
        "@chromatic-com/storybook",
    ],
    framework: {
        name: "@storybook/react-vite",
        options: {},
    },
};
export default config;
