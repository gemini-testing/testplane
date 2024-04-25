## Migration from Hermione

<!-- DOCTOC SKIP -->

Testplane@8.x is backward compatible with Hermione@8.

To migrate from Hermione to Testplane you need to:
- Replace hermione deps with tesplane in package.json (`npm uninstall hermione && npm install -D testplane`);
- Replace "hermione" with "testplane" in `compilerOptions.types` field of your `tsconfig.json` file;
- Replace all imports, requires and declarations:
  - `import ... from "hermione"` -> `import ... from "testplane"`
  - `require("hermione")` -> `require("testplane")`
  - `declare module "hermione"` -> `declare module "testplane"`

Other than that, everything should be fine. Hermione plugins are fully compatible with Testplane@8.x.

Optional changes list. These are not required, but recommended:
- Use `testplane` binary instead of `hermione` binary;
- Rename `.hermione.conf.ts`, `.hermione.conf.js` configs to `.testplane.conf.ts`, `.testplane.conf.js`;
- Use `globalThis.testplane` helper instead of `globalThis.hermione`;
- Use `testplane_` environment variables instead of `hermione_` environment variables;
- Use `TESTPLANE_` environment variables (for sets and skip browsers) instead of `HERMIONE_` environment variables;
- Use explicit `hermione-` prefix for plugins, if necessary;
- Use [`TestplaneCtx`](./typescript.md#testplanectx-typings) instead of `HermioneCtx` type;
- Use `executionContext.testplaneCtx` as browser property instead of `executionContext.hermioneCtx`;
- If you use default [screenshotsDir](./config.md#screenshotsdir) value, rename "hermione/screens" directory to "testplane/screens" or specify the value "hermione/screens" explicitly;
- If you use default [sets.files](./config.md#sets) value, move your tests from "hermione" to "testplane" directory or specify the value "hermione" explicitly;
