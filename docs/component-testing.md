## Testplane Component Testing (experimental)

Almost every modern web interfaces
Almost all modern web interfaces are written using frameworks (React, Vue, Svelte, ...) to simplify the creation, reuse and composition of web components. It is important to test such components in isolation from each other to be sure each component is doing its job correctly. Just like we write unit tests separately from integration tests. Testplane already supports testing components using [Storybook](https://storybook.js.org/) (via [@testplane/storybook](https://github.com/gemini-testing/testplane-storybook) plugin), but this tool is not relevant for all projects. Therefore, we have developed another component testing option that does not require the use of Storybook.

### Implementation options for component testing

Component testing is a type of testing in which the logic of a web component is tested in isolation from the web page in which it is used. In order to perform such a test, you need to be able to render the component correctly. [JSDom](https://github.com/jsdom/jsdom) is often used for this task (it is also used inside Jest), which renders web components using the Node.js virtual renderer, that is without using a real browser. On the one hand, it works faster (the browser is not being launched), and on the other hand, it is less stable, since the checks are not performed in a real browser. The second popular solution is to use a very fast dev server [Vite](https://vitejs.dev/), which supports many frameworks (React, Vue, Svelte, ...) and is responsible for rendering components in isolation.

We chose the option using Vite, as this approach ensures the page is tested more closely to reality (as if the user had opened it). At the same time, the tests themselves run a little longer than in the JSDom. But the most important thing for us is the stability and reproducibility of the test results, so the choice was obvious.

### How to use it?

We will set up testing of react components written in Typescript. Therefore, first of all, we will install the necessary dependencies:

```bash
npm i testplane vite @vitejs/plugin-react @testing-library/react --save-dev
npm i react --save
```

Now let's create a Vite config in which we will connect the plugin to support React. Example:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        react(),
    ]
});
```

After that, we will configure the tests to run in the browser. To do this, specify the [testRunEnv](./config.md#testrunenv) option. Example:

```typescript
// .testplane.conf.ts
export const {
    // ...
    system: {
        // ...
        testRunEnv: ['browser', { viteConfig: './vite.config.ts' }],
    },
    sets: {
        linux: {
            files: [
                'src/tests/**/*.testplane.tsx'
            ],
            browsers: [
                'chrome'
            ]
        },
    },
}
```

And in the end, we can write a test in which we simply output the `document` value to the console without using the [browser.execute](https://webdriver.io/docs/api/browser/execute) command:

```typescript
// src/tests/test.testplane.tsx
it('should log document', async () => {
    console.log(document);
});
```

If such a test were performed in a Node.js environment, then it would have fallen with the error: `ReferenceError: document is not defined`. But in our case, it will be executed directly in the browser, where the global variable `document` is available. Therefore, in the browser and terminal log (we will tell you about this feature below) we will see the following:

```
{
  location: {
    ancestorOrigins: {},
    href: 'http://localhost:56292/run-uuids/23d2af81-4259-425c-8214-c9e770d75ea4',
    origin: 'http://localhost:56292',
    protocol: 'http:',
    host: 'localhost:56292',
    hostname: 'localhost',
    port: '56292',
    pathname: '/run-uuids/23d2af81-4259-425c-8214-c9e770d75ea4',
    search: '',
    hash: ''
  }
}
```

Let's write a more complex test with a render of the react component:

```typescript
// src/tests/test.testplane.tsx
import { useState } from 'react';
import { render } from '@testing-library/react';

// A simple component with a title and a counter button
function Component() {
    const [count, setCount] = useState(0);

    return (
        <div id="root">
            <h1>Testplane Component Testing</h1>
            <button onClick={() => setCount((count) => count + 1)}>
                count is {count}
            </button>
        </div>
    );
}

it('should render react button', async ({browser}) => {
    render(<Component />); // rendering the component on the generated Vite page

    const button = await browser.$("button");

    await button.click();
    await button.click();

    await expect(button).toHaveText("count is 2");
});
```

A fully working examples can be found [here](../examples/component-testing/).

> ⚠️ Currently, there are the following restrictions:
> - only components written in React in files `.jsx` and `.tsx` are supported. Ability to write tests in `.js` files will be implemented soon. We will also support the Vue framework in the near future;
> - there is no access to `currentTest` from `it`, `beforeEach` and `afterEach`. It will appear in the near future;
> - the [@testplane/global-hook](https://github.com/gemini-testing/testplane-global-hook) plugin is temporarily not supported.


### What additional features are supported?

#### Hot Module Replacement (HMR)

[HMR](https://vitejs.dev/guide/api-hmr.html) is supported in Vite. It means if you change the loaded file, either the component will be remounted, or the page will be completely preloaded. If the component is described in a separate file (i.e. not in the same file as the test), a remount will be performed, but the test will not be restarted. And if you change the test file, the page will be reloaded, which will cause Testplane to interrupt the execution of the current test and start it again. Due to this feature, you can quickly develop components in Vite and write tests for them. It is recommended to use it together with the [REPL mode](./cli.md#repl-mode).

#### Using the browser and expect instances directly in the browser DevTools

Instances of the `browser` and `expect` are available inside of the browser's global scope. It is quite convenient to use it when debugging the test.

#### Logs from the browser console in the terminal

Calling the `log`, `info`, `warn`, `error`, `debug` and `table` commands on the `console` object in the browser causes information to be displayed not only in the browser's DevTools, but also in the terminal from which Testplane was launched. I.e., you can call `console.log` in the test/component and you will be able to see the result of it execution in the terminal. This is especially handy when debugging the test.
