/// <reference types="../../build/src/index.d.ts" />

declare module "*.html?raw" {
    const content: string;
    export default content;
}
