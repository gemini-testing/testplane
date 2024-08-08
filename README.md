<p align="center">
  <a href="https://testplane.io/">
    <picture>
      <img alt="Testplane" src="docs/images/testplane.svg" width="220" style="max-width: 100%;">
    </picture>
  </a>
</p>

<p align="center">
Fast, scalable and robust testing solution for the ever-evolving web landscape.
</p>

<p align="center">
    <a href="https://www.npmjs.com/package/testplane"><img src="https://img.shields.io/npm/dt/hermione.svg" alt="Total Downloads"></a>
    <a href="https://github.com/gemini-testing/testplane/releases"><img src="https://img.shields.io/npm/v/testplane.svg" alt="Latest Release"></a>
    <a href="https://github.com/gemini-testing/testplane/blob/master/LICENSE"><img src="https://img.shields.io/npm/l/hermione.svg" alt="License"></a>
    <a href="https://t.me/testplane"><img src="https://img.shields.io/badge/community-chat-blue?logo=telegram" alt="Community Chat"></a>
</p>

---

Testplane (ex-Hermione) is a battle-hardened framework for testing web apps at any scale, any browser and any platform.

🧑‍💻 **Developer Friendly:** Enjoy a hassle-free start with our installation wizard, TypeScript support, instant feedback via live test editing, advanced HTML-reporter, and smart features like auto-wait and retries.

📸 **Visual Testing Redefined:** Capture anything from specific details to whole pages, manage diffs with a streamlined UI, explore a variety of diff modes and let Testplane tackle flakiness.

🌐 **Test Across Environments:** Forget being tied to a couple of latest Chrome builds. Testplane goes beyond that, offering testing on real devices and broad automation protocol support, mirroring your users' actual environments.

📈 **Scale Effortlessly:** Run thousands of tests on a remote browser grid or benefit from ultra-fast local execution. Testplane offers sharding, parallel test execution, and isolated browser contexts.

⚡ **Infinite Extensibility:** Testplane offers a versatile plugin system with dozens of open-source plugins on GitHub, along with custom reporters, commands, and execution logic.

📦 **Various Test Environments:** With Testplane you can run tests not only in Node.js environment but also in the browser. It means you can run e2e/integration tests in Node.js and [component](docs/component-testing.md)/unit tests in browser.

## Getting started

> Note: if you prefer manual installation, you can run `npm i -D testplane`. Check out [the Docs](https://testplane.io/docs/v8/) for details.

1. Use the CLI wizard to set up testplane and generate basic configuration:

    ```shell
    npm init testplane@latest new-testplane-project
    ```

   You may add `-- --verbose` argument to launch a tool in *extra-questions* mode, to pick custom package manager or install extra plugins.

2. Open the newly generated file `testplane-tests/example.testplane.ts`. We’ll modify the test to ensure the description includes expected text:

    ```typescript
    describe("test", () => {
        it("example", async ({browser}) => {
            await browser.url("https://example.com/");

            const description = await browser.$("p");

            await expect(description).toHaveTextContaining("for use in illustrative examples in documents");
        });
    });
    ```

3. Launch GUI:

    ```shell
    npx testplane gui
   ```

4. Try running the test and watch it pass. Now, let's replace description text check with a visual assertion. Use the `assertView` command to carry out visual checks:

    ```diff
    - await expect(description).toHaveTextContaining("for use in illustrative examples in documents");
    + await description.assertView("description"); // "description" is just a name of the assertion
      ```

5. Run the test again. It will fail, because a reference image for the heading is missing. You can accept the diff and re-run the test, it will then pass.

Congratulations on writing your first Testplane test, which navigates to a page and executes a visual assertion. Dive into the Docs to discover more awesome features Testplane has to offer!

## Docs

You can find the Docs [on our website](https://testplane.io/).

Feel free to visit these pages for a brief overview of some of Testplane features:

- [Testplane Features Overview](docs/features.md)
- [Quick Start](docs/quick-start.md)
- [Dealing with Browsers](docs/dealing-with-browsers.md)
- [Writing Tests](docs/writing-tests.md)
- [Browser Commands Reference](docs/commands.md)
- [Testplane Config Reference](https://testplane.io/docs/v8/config/main/)
- [Testplane × Typescript](docs/typescript.md)
- [Testplane CLI](docs/cli.md)
- [Testplane Events](docs/events.md)
- [Testplane Programmatic API](docs/programmatic-api.md)
- [Testplane Component Testing (experimental)](docs/component-testing.md)
- [Testplane Debugging](docs/debugging.md)

We post the most actual info, guides and changelogs on the website. You can improve it by sending pull requests to [this repository](https://github.com/gemini-testing/testplane-docs/).

## Rename from "Hermione"

This project was formerly known as "Hermione", but eventually some copyright and trademark issues surfaced, leading to the decision to rebrand. After some discussion, we settled on "Testplane" as the official new title. Considering this change as merely a rebranding, we've proceeded with the existing version count instead of starting anew. Thus, Testplane `v8.x` is a drop-in replacement for Hermione `v8.x`.

Learn more about migration from Hermione to Testplane in [the Docs](https://testplane.io/docs/v8/migrations/how-to-upgrade-hermione-to-testplane/).

## Contributing

Our mission with this repository is to make the Testplane development process open, while continuing to improve upon its features, performance and ease of use. We hope other organizations find value in our project and benefit from our work.

We welcome and appreciate community contributions. To ensure our efforts are in sync, we recommend to raise an issue or leave a comment beforehand.

Visit our [contributing guide](CONTRIBUTING.md) to understand more about our development process and how to get involved.

## License
Testplane is [MIT licensed](LICENSE).
