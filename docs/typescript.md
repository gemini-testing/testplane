<!-- DOCTOC SKIP -->
## Testplane × Typescript

To write Testplane tests on typescript, you would need to install `ts-node`:

```bash
npm i -D ts-node
```

And include Testplane types in your `tsconfig.json` file:

```json
// tsconfig.json
{
    // other tsconfig options
    "compilerOptions": {
        // other compiler options
        "types": [
            // other types
            "testplane",
        ]
    }
}
```

Recommended config:

```json
{
    "compilerOptions": {
        "types": [
            "testplane"
        ],
        "sourceMap": true,
        "outDir": "../test-dist",
        "target": "ESNext",
        "module": "CommonJS",
        "strict": true,
        "lib": ["esnext", "dom"],
        "esModuleInterop": true
    }
}
```

Note: this is the strictest possible setting, which works on Typescript 5.3+. If you want faster type-checks or have older Typescript version, use `"skipLibCheck": true` in `compilerOptions`.

### testplane.ctx typings

If you want to extend testplane.ctx typings, you could use module augmentation:

```ts
import type { TestplaneCtx } from "testplane";

declare module "testplane" {
    interface TestplaneCtx {
        someVariable: string;
    }
}
```

Now `testplane.ctx` will have `someVariable` typings

### Extending executionContext.ctx

`executionContext.ctx` is handy when you have some data specific to every test, and you want to share it across custom commands, test hooks and test body.

Let's see how it works in practice.

1. Let's save something to `executionContext.ctx` in `beforeEach` global hook (provided by testplane-global-hook plugin):
   ```typescript
   import type { TestFunctionCtx } from 'testplane';
   import { Api } from './api';

   beforeEach(async (this: TestFunctionCtx) => {
     // Assume this is some custom command you want to run before each test
     await this.browser.auth();

     // Assume after auth we have access to a cookie needed to make requests to API
     const sessionIdCookie = await this.getCookies(['Session_id']).then(cookies => cookies?.[0]?.value);
     const api = new Api(sessionIdCookie);

     // Now we want to make api available via executionContext.ctx
     this.api = api;
   })
   ```

2. Access saved data in other places:
   ```typescript
   // Assume we are implementing a custom command to get profile info
   export async function getProfileInfo() {
       const api = this.executionContext.ctx.api;

       return api.getProfileInfo();
   }
   ```

This becomes useful when you have many commands utilising ctx. You don't need to make requests or get data over and over, you can do it once and save in ctx for future use.

Now, to make it type-safe in TypeScript, we could write the following module augmentation:

```ts
import type { TestplaneCtx } from "testplane";
import type { Api } from './api';

declare module "testplane" {
    interface ExecutionThreadCtx {
        api: Api;
    }
}
```

Now `executionContext.ctx` will include `Api` typings.

### Optional typed linting

The built-in [missing-await check](./writing-tests.md#missing-await-checks) runs for both JS and TS without a user `tsconfig.json` or ESLint setup. Available types improve recognition of imported helpers and custom commands; a `.ts` extension alone does not supply reliable types or complete promise-flow analysis.

Typed ESLint is an additional editor/CI layer, not a prerequisite. For example, with ESLint 8 and `@typescript-eslint/parser` / `@typescript-eslint/eslint-plugin` **6.12.0**, a legacy configuration can enable:

```js
module.exports = {
    parser: "@typescript-eslint/parser",
    parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
    },
    plugins: ["@typescript-eslint"],
    rules: {
        "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: false }],
        "@typescript-eslint/no-misused-promises": "error",
    },
};
```

Include your tests in that TypeScript project. Adapt the configuration to the ESLint/typescript-eslint versions installed in your project; newer options are not necessarily available in 6.12.0.

These rules complement, rather than replace, Testplane's check: `no-floating-promises` in that version permits assigning a promise to a variable and attaching a rejection handler. Neither operation proves that the test waits for completion. Missing/`any` types and dynamic custom commands also limit typed linting.
