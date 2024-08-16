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

Now you will be able to write Testplane tests using typescript.

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
