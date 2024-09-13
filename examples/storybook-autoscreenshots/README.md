# Visual testing with Storybook

A project with an example of using automatic screenshot testing of Storybook components.

## How to start

Install dependencies:

```bash
nvm use
npm ci
```

Run storybook-tests with `--update-refs` option to generate reference image at first time:

```
npx testplane --storybook --update-refs
```

You can also use GUI-mode to view results, launch/relaunch tests and accept/update screenshots:

```
npx testplane gui --storybook
```

Storybook examples will be available at `http://localhost:6006/` after the `npm run storybook` command has been run.

## Project structure


```
|____.storybook // storybook config
|____.testplane.conf.ts // file with testplane configuration
|____testplane-tests // directory with testplane test example (without storybook)
|____src
| |____stories // directory with your stories
| | |____Button.stories.ts // file with a single story for the Button component
| | |____Button.stories.ts-screens // directory where your screenshots for the Button tests will be stored
| | |____Page.stories.ts
| | |____Page.stories.ts-screens

```