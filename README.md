<p align="center">
  <picture>
    <img alt="Testplane" src="https://raw.githubusercontent.com/gemini-testing/hermione/HEAD/docs/images/testplane.svg" width="220" style="max-width: 100%;">
  </picture>
</p>

<p align="center">
Fast, scalable and robust testing solution for the ever-evolving web landscape.
</p>

<p align="center">
    <a href="https://www.npmjs.com/package/testplane"><img src="https://img.shields.io/npm/dt/hermione.svg" alt="Total Downloads"></a>
    <a href="https://github.com/gemini-testing/testplane/releases"><img src="https://img.shields.io/npm/v/testplane.svg" alt="Latest Release"></a>
    <a href="https://github.com/gemini-testing/testplane/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/hermione.svg" alt="License"></a>
</p>

---

Testplane (ex-Hermione) is a battle-hardened framework for testing web apps at any scale, any browser and any platform.

🧑‍💻 **Developer Friendly:** Enjoy a hassle-free start with our installation wizard, TypeScript support, instant feedback via live test editing, advanced HTML-reporter, and smart features like auto-wait and retries.

📸 **Visual Testing Redefined:** Capture anything from specific details to whole pages, manage diffs with a streamlined UI, explore a variety of diff modes and let Testplane tackle flakiness.

🌐 **Test Across Environments:** Forget being tied to a couple of latest Chrome builds. Testplane goes beyond that, offering testing on real devices and broad automation protocol support, mirroring your users' actual environments.

📈 **Scale Effortlessly:** Run thousands of tests on a remote browser grid or benefit from ultra-fast local execution. Testplane offers sharding, parallel test execution, and isolated browser contexts.

⚡ **Infinite Extensibility:** Testplane offers a versatile plugin system with dozens of open-source plugins on GitHub, along with custom reporters, commands, and execution logic.

## Getting started

> Note: if you prefer manual installation, you can run `npm i -D testplane`. Check out [the Docs](https://github.com/gemini-testing/hermione/blob/master/docs/quick-start.md) for details.  

1. Use the CLI wizard to set up testplane and generate basic configuration:

    ```shell
    mkdir new-testplane-project && cd new-testplane-project
    npm init testplane@latest
    ```
   
2. Open the newly generated file `testplane-tests/example.testplane.ts`. We’ll modify the test to ensure the heading matches its expected appearance. Use the `assertView` command to carry out visual checks:

    ```typescript 
    describe("test", () => {
        it("example", async ({browser}) => {
            await browser.url("https://example.com/");
    
            await browser.$("h1").assertView("heading"); // "heading" is just a name of the assertion 
        });
    });
    ```

3. Launch GUI:

    ```shell
    npx testplane gui
   ```
   
4. Try running the test, which will initially fail because a reference image for the heading is missing. You can accept the diff and re-run the test, it will then pass.

Congratulations on writing your first Testplane test, which navigates to a page and executes a visual assertion. Dive into the Docs to discover more awesome features Testplane has to offer!

## Docs

The documentation is divided into several sections:

- [Testplane Features Overview](https://github.com/gemini-testing/hermione/blob/master/docs/features.md)
- [Quick Start](https://github.com/gemini-testing/hermione/blob/master/docs/quick-start.md)
- [Dealing with Browsers](https://github.com/gemini-testing/hermione/blob/master/docs/dealing-with-browsers.md)
- [Writing Tests](https://github.com/gemini-testing/hermione/blob/master/docs/writing-tests.md)
- [Browser Commands Reference](https://github.com/gemini-testing/hermione/blob/master/docs/commands.md)
- [Testplane Config Reference](https://github.com/gemini-testing/hermione/blob/master/docs/config.md)
- [Testplane × Typescript](https://github.com/gemini-testing/hermione/blob/master/docs/typescript.md)
- [Testplane CLI](https://github.com/gemini-testing/hermione/blob/master/docs/cli.md)
- [Testplane Events](https://github.com/gemini-testing/hermione/blob/master/docs/events.md)
- [Testplane Programmatic API](https://github.com/gemini-testing/hermione/blob/master/docs/programmatic-api.md)

## Rename from "hermione"

This project was formerly known as "hermione", but eventually some copyright and trademark issues surfaced, leading to the decision to rebrand. After some discussion, we settled on "Testplane" as the official new title. We've tailored Testplane `v1` to be a drop-in replacement for Hermione `v8`.

## Contributing

Our mission with this repository is to make the Testplane development process open, while continuing to improve upon its features, performance and ease of use. We hope other organizations find value in our project and benefit from our work.

We welcome and appreciate community contributions. To ensure our efforts are in sync, we recommend to raise an issue or leave a comment beforehand. 

Visit our [contributing guide](https://github.com/gemini-testing/hermione/blob/master/CONTRIBUTING.md) to understand more about our development process and how to get involved.

## License
Testplane is [MIT licensed](https://github.com/gemini-testing/hermione/blob/master/LICENSE).
