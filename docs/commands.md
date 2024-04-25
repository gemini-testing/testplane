## Browser Commands Reference

Since Testplane is based on [WebdriverIO v8](https://webdriver.io/docs/api/), all the commands provided by WebdriverIO are available in it. But Testplane also has its own commands.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
### Contents

- [Browser commands](#browser-commands)
  - [clearSession](#clearsession)
- [Element commands](#element-commands)
  - [moveCursorTo](#movecursorto)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

### Browser commands

#### clearSession

Browser command that clears session state (deletes cookies, clears local and session storages). For example:

```js
it('test', async ({ browser }) => {
    await browser.url('https://github.com/gemini-testing/testplane');

    (await browser.getCookies()).length; // 5
    await browser.execute(() => localStorage.length); // 2
    await browser.execute(() => sessionStorage.length); // 1

    await browser.clearSession();

    (await browser.getCookies()).length; // 0
    await browser.execute(() => localStorage.length); // 0
    await browser.execute(() => sessionStorage.length); // 0
});
```

### Element commands

#### moveCursorTo

> This command is temporary and will be removed in the next major (`testplane@9.x`). Differs from the standard [moveTo](https://webdriver.io/docs/api/element/moveTo/) in that it moves the cursor relative to the top-left corner of the element (like it was in `hermione@7`).

Move the mouse by an offset of the specified element. If offset is not specified then mouse will be moved to the top-left corder of the element.

Usage:

```typescript
await browser.$(selector).moveCursorTo({ xOffset, yOffset });
```

Available parameters:

* **xOffset** (optional) `Number` – X offset to move to, relative to the top-left corner of the element;
* **yOffset** (optional) `Number` – Y offset to move to, relative to the top-left corner of the element.
