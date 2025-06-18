import sinon from "sinon";
import { JSDOM } from "jsdom";

import { captureDomSnapshotInBrowser } from "src/browser/commands/captureDomSnapshot";

describe('"captureDomSnapshot" command', () => {
    const sandbox = sinon.createSandbox();
    let jsdomInstance: JSDOM;
    let window: Window & typeof globalThis;
    let document: Document;

    beforeEach(() => {
        jsdomInstance = new JSDOM(
            `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Test Page</title>
                </head>
                <body>
                </body>
            </html>
        `,
            {
                pretendToBeVisual: true,
                resources: "usable",
            },
        );

        window = jsdomInstance.window as unknown as Window & typeof globalThis;
        document = window.document;

        global.window = window;
        global.document = document;
        global.Node = window.Node;

        global.SVGElement = window.SVGElement;
    });

    afterEach(() => {
        jsdomInstance.window.close();
        (global as any).window = undefined;
        (global as any).document = undefined;
        (global as any).Node = undefined;
        (global as any).SVGElement = undefined;
        sandbox.restore();
    });

    describe("basic functionality", () => {
        it("should return snapshot for empty body", () => {
            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /# No visible elements found/);
            assert.deepEqual(result.omittedTags, []);
            assert.deepEqual(result.omittedAttributes, []);
            assert.equal(result.textWasTruncated, false);
        });

        it("should capture simple div element", () => {
            document.body.innerHTML = '<div id="test" class="container">Hello World</div>';

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /- body.*:/);
            assert.match(result.snapshot, /- div\.container#test.*"Hello World"/);
            assert.equal(result.textWasTruncated, false);
        });

        it("should handle nested elements", () => {
            document.body.innerHTML = `
                <div class="parent">
                    <span class="child">Child text</span>
                    <p>Paragraph text</p>
                </div>
            `;

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /- div\.parent.*:/);
            assert.match(result.snapshot, /- span\.child.*"Child text"/);
            assert.match(result.snapshot, /- p.*"Paragraph text"/);
        });

        it("should exclude default excluded tags", () => {
            document.body.innerHTML = `
                <div>Visible content</div>
                <script>console.log('test');</script>
                <style>body { color: red; }</style>
            `;

            const result = captureDomSnapshotInBrowser();

            assert.notMatch(result.snapshot, /script/);
            assert.notMatch(result.snapshot, /style/);
            assert.match(result.snapshot, /div.*"Visible content"/);
            assert.include(result.omittedTags, "script");
            assert.include(result.omittedTags, "style");
        });

        it("should handle elements with multiple classes", () => {
            document.body.innerHTML = '<div class="class1 class2 class3">Multiple classes</div>';

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /div\.class1\.class2\.class3.*"Multiple classes"/);
        });

        it("should handle elements with various attributes", () => {
            document.body.innerHTML = `
                <input type="text" name="username" placeholder="Enter username" data-testid="username-input">
            `;

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /input/);
            assert.match(result.snapshot, /type=text/);
            assert.match(result.snapshot, /name=username/);
            assert.match(result.snapshot, /placeholder="Enter username"/);
            assert.match(result.snapshot, /data-testid=username-input/);
        });
    });

    describe("text handling", () => {
        it("should extract direct text content", () => {
            document.body.innerHTML = "<p>Direct text content</p>";

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /p.*"Direct text content"/);
        });

        it("should truncate long text when enabled", () => {
            const longText = "A".repeat(200);
            document.body.innerHTML = `<p>${longText}</p>`;

            const result = captureDomSnapshotInBrowser({ maxTextLength: 50 });

            assert.match(result.snapshot, /p.*"A{50}\.\.\."/);
            assert.equal(result.textWasTruncated, true);
        });

        it("should not truncate text when disabled", () => {
            const longText = "A".repeat(200);
            document.body.innerHTML = `<p>${longText}</p>`;

            const result = captureDomSnapshotInBrowser({ truncateText: false, maxTextLength: 50 });

            assert.match(result.snapshot, new RegExp(`p.*"${longText}"`));
            assert.equal(result.textWasTruncated, false);
        });

        it("should escape quotes in text", () => {
            document.body.innerHTML = '<p>Text with "quotes" inside</p>';

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /p.*"Text with \\"quotes\\" inside"/);
        });

        it("should escape newlines in text", () => {
            document.body.innerHTML = "<p>Text with\nnewlines</p>";

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /p.*"Text with\\nnewlines"/);
        });

        it("should ignore whitespace-only text nodes", () => {
            document.body.innerHTML = "<div>   \n\t   </div>";

            const result = captureDomSnapshotInBrowser();

            // The div should appear but without any text content
            assert.notMatch(result.snapshot, /div.*"/);
        });
    });

    describe("attribute handling", () => {
        it("should include useful attributes by default", () => {
            document.body.innerHTML = `
                <input 
                    id="test-input" 
                    class="form-control" 
                    type="email" 
                    name="email" 
                    placeholder="Enter email"
                    aria-label="Email input"
                    data-testid="email-field"
                    required
                    disabled
                />
            `;

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /input\.form-control#test-input/);
            assert.match(result.snapshot, /type=email/);
            assert.match(result.snapshot, /name=email/);
            assert.match(result.snapshot, /placeholder="Enter email"/);
            assert.match(result.snapshot, /aria-label="Email input"/);
            assert.match(result.snapshot, /data-testid=email-field/);
            assert.match(result.snapshot, /required/);
            assert.match(result.snapshot, /disabled/);
        });

        it("should omit non-useful attributes", () => {
            document.body.innerHTML = '<div style="color: red;" onclick="alert(1)" custom-attr="value">Content</div>';

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /div.*"Content"/);

            assert.notMatch(result.snapshot, /style=/);
            assert.include(result.omittedAttributes, "style");
            assert.include(result.omittedAttributes, "onclick");
            assert.include(result.omittedAttributes, "custom-attr");
        });

        it("should handle attributes with spaces and quotes", () => {
            document.body.innerHTML = "<div title='Text with spaces and \"quotes\"'>Content</div>";

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /title="Text with spaces and \\"quotes\\""/);
            assert.match(result.snapshot, /div.*"Content"/);
        });

        it("should truncate very long attribute values", () => {
            const longValue = "A".repeat(150);
            document.body.innerHTML = `<div title="${longValue}">Content</div>`;

            const result = captureDomSnapshotInBrowser({ maxTextLength: 100 });

            assert.match(result.snapshot, /title=A{100}\.\.\./);
            assert.match(result.snapshot, /div.*"Content"/);
        });
    });

    describe("element visibility", () => {
        it("should mark hidden elements with display none", () => {
            document.body.innerHTML = '<div style="display: none;">Hidden content</div>';

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /@hidden/);
        });

        it("should mark hidden elements with visibility hidden", () => {
            document.body.innerHTML = '<div style="visibility: hidden;">Hidden content</div>';

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /@hidden/);
        });

        it("should mark hidden elements with opacity 0", () => {
            document.body.innerHTML = '<div style="opacity: 0;">Hidden content</div>';

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /@hidden/);
        });
    });

    describe("SVG element handling", () => {
        it("should handle SVG elements", () => {
            document.body.innerHTML = `
                <svg width="100" height="100" style="display: block;">
                    <circle cx="50" cy="50" r="40" fill="red" />
                    <text x="50" y="50">SVG Text</text>
                </svg>
            `;

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /svg/);
            assert.notMatch(result.snapshot, /circle/);
            assert.notMatch(result.snapshot, /text/);
        });

        it("should handle SVG with test attributes", () => {
            document.body.innerHTML = `
                <svg data-testid="test-svg" width="100" height="100" style="display: block;">
                    <circle cx="50" cy="50" r="40" fill="red" />
                </svg>
            `;

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /svg.*data-testid=test-svg/);
        });

        it("should handle SVG in a container", () => {
            document.body.innerHTML = `
                <div class="svg-container">
                    <svg width="50" height="50" viewBox="0 0 50 50">
                        <circle cx="25" cy="25" r="20" fill="green" />
                    </svg>
                </div>
            `;

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /div.*svg-container/);
            assert.match(result.snapshot, /svg/);
        });

        it("should not capture empty SVG elements without children or test attributes", () => {
            document.body.innerHTML = `
                <svg width="100" height="100"></svg>
            `;

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /# No visible elements found/);
        });

        it("should capture SVG elements with useful attributes", () => {
            document.body.innerHTML = `
                <svg width="100" height="100" viewBox="0 0 100 100" class="icon" id="main-svg" title="Main Icon">
                    <rect width="50" height="50" fill="blue" />
                </svg>
            `;

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /svg\.icon#main-svg/);
            assert.match(result.snapshot, /title="Main Icon"/);
            assert.notMatch(result.snapshot, /viewBox/);
            assert.include(result.omittedAttributes, "viewbox");
        });

        it("should handle real-world SVG example", () => {
            document.body.innerHTML = `
                <div class="header">
                    <h1>My App</h1>
                    <svg class="logo" width="24" height="24" data-testid="app-logo">
                        <path d="M12 2L2 7v10c0 5.55 3.84 10 9 11 5.16-1 9-5.45 9-11V7l-10-5z"/>
                    </svg>
                    <button class="menu-btn">
                        <svg class="icon" width="16" height="16">
                            <line x1="3" y1="6" x2="21" y2="6"/>
                            <line x1="3" y1="12" x2="21" y2="12"/>
                            <line x1="3" y1="18" x2="21" y2="18"/>
                        </svg>
                    </button>
                </div>
            `;

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /div\.header/);
            assert.match(result.snapshot, /h1.*"My App"/);
            assert.match(result.snapshot, /svg\.logo.*data-testid=app-logo/);
            assert.match(result.snapshot, /button\.menu-btn/);
            assert.match(result.snapshot, /svg\.icon/);

            assert.notMatch(result.snapshot, /path/);
            assert.notMatch(result.snapshot, /line/);
        });
    });

    describe("element state detection", () => {
        it("should detect focused elements", () => {
            document.body.innerHTML = '<input type="text" id="test-input">';
            const input = document.getElementById("test-input") as HTMLInputElement;
            input.focus();

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /@focused/);
        });

        it("should detect dynamically set input values", () => {
            document.body.innerHTML = '<input type="text" value="default value">';
            const input = document.querySelector("input") as HTMLInputElement;

            input.value = "hello, world";

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /@value="hello, world"/);
            assert.match(result.snapshot, /value="default value"/);
        });

        it("should detect dynamically checked checkboxes", () => {
            document.body.innerHTML = '<input type="checkbox" name="terms">';
            const checkbox = document.querySelector("input") as HTMLInputElement;

            checkbox.checked = true;

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /@checked/);
        });

        it("should detect dynamically checked radio buttons", () => {
            document.body.innerHTML = `
                <input type="radio" name="color" value="red">
                <input type="radio" name="color" value="blue">
                <input type="radio" name="color" value="green">
            `;

            const blueRadio = document.querySelector('input[value="blue"]') as HTMLInputElement;
            blueRadio.checked = true;

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /input.*value=blue.*@checked/);
            assert.notMatch(result.snapshot, /input.*value=red.*@checked/);
            assert.notMatch(result.snapshot, /input.*value=green.*@checked/);
        });

        it("should detect dynamically set textarea values", () => {
            document.body.innerHTML = '<textarea name="description"></textarea>';
            const textarea = document.querySelector("textarea") as HTMLTextAreaElement;

            textarea.value = "This is a long description\nwith multiple lines.";

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /@value="This is a long description\\nwith multiple lines\."/);
        });

        it("should detect dynamically selected options", () => {
            document.body.innerHTML = `
                <select name="country">
                    <option value="us">United States</option>
                    <option value="ca">Canada</option>
                    <option value="uk">United Kingdom</option>
                </select>
            `;

            const select = document.querySelector("select") as HTMLSelectElement;
            select.selectedIndex = 1;

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /@selected=ca/);
            assert.match(result.snapshot, /@selectedText=Canada/);
        });

        it("should handle form validation states", () => {
            document.body.innerHTML = '<input type="email" required name="email">';
            const input = document.querySelector("input") as HTMLInputElement;

            input.value = "invalid-email";

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /@invalid/);
        });
    });

    describe("interactive content detection", () => {
        it("should detect button elements", () => {
            document.body.innerHTML = "<button>Click me</button>";

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /button.*"Click me"/);
        });

        it("should detect input elements", () => {
            document.body.innerHTML = '<input type="button" value="Button Input">';

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /input.*value="Button Input"/);
        });

        it("should detect links", () => {
            document.body.innerHTML = '<a href="#test">Link text</a>';

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /a.*href=#test.*"Link text"/);
        });

        it("should detect elements with onclick", () => {
            document.body.innerHTML = '<div onclick="alert(1)">Clickable div</div>';

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /div.*"Clickable div"/);
            // onclick should be omitted but element should still be captured
            assert.include(result.omittedAttributes, "onclick");
        });

        it("should detect elements with tabindex", () => {
            document.body.innerHTML = '<div tabindex="0">Focusable div</div>';

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /div.*tabindex=0.*"Focusable div"/);
        });

        it("should detect elements with button role", () => {
            document.body.innerHTML = '<div role="button">Button-like div</div>';

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /div.*role=button.*"Button-like div"/);
        });
    });

    describe("configuration options", () => {
        it("should include specified tags when using includeTags", () => {
            document.body.innerHTML = `
                <div>Visible content</div>
                <script>console.log('test');</script>
            `;

            const result = captureDomSnapshotInBrowser({ includeTags: ["script"] });

            assert.match(result.snapshot, /div.*"Visible content"/);
            assert.match(result.snapshot, /script/);
            assert.notInclude(result.omittedTags, "script");
        });

        it("should exclude specified tags when using excludeTags", () => {
            document.body.innerHTML = `
                <div>Content 1</div>
                <p>Content 2</p>
            `;

            const result = captureDomSnapshotInBrowser({ excludeTags: ["p"] });

            assert.match(result.snapshot, /div.*"Content 1"/);
            assert.notMatch(result.snapshot, /p.*"Content 2"/);
            assert.include(result.omittedTags, "p");
        });

        it("should include specified attributes when using includeAttrs", () => {
            document.body.innerHTML = '<div style="color: red;" custom-attr="value">Content</div>';

            const result = captureDomSnapshotInBrowser({ includeAttrs: ["style", "custom-attr"] });

            assert.match(result.snapshot, /style="color: red;"/);
            assert.match(result.snapshot, /custom-attr=value/);
            assert.notInclude(result.omittedAttributes, "style");
            assert.notInclude(result.omittedAttributes, "custom-attr");
        });

        it("should exclude specified attributes when using excludeAttrs", () => {
            document.body.innerHTML = '<div id="test" class="container">Content</div>';

            const result = captureDomSnapshotInBrowser({ excludeAttrs: ["id", "class"] });

            // Should not have id or class in the selector or attributes
            assert.notMatch(result.snapshot, /div\.container#test/);
            assert.notMatch(result.snapshot, /id=/);
            assert.notMatch(result.snapshot, /class=/);
            assert.match(result.snapshot, /div.*"Content"/);
        });

        it("should combine multiple configuration options", () => {
            document.body.innerHTML = `
                <div id="keep" style="color: red;">Keep this</div>
                <p class="remove">Remove this</p>
                <script>console.log('include this');</script>
            `;

            const result = captureDomSnapshotInBrowser({
                includeTags: ["script"],
                excludeTags: ["p"],
                includeAttrs: ["style"],
                excludeAttrs: ["id"],
            });

            assert.match(result.snapshot, /div.*style="color: red;".*"Keep this"/);
            assert.notMatch(result.snapshot, /div.*#keep/); // id should be excluded
            assert.notMatch(result.snapshot, /p.*"Remove this"/); // p should be excluded
            assert.match(result.snapshot, /script/); // script should be included
            assert.include(result.omittedTags, "p");
            assert.notInclude(result.omittedTags, "script");
        });
    });

    describe("edge cases", () => {
        it("should handle self-closing tags", () => {
            document.body.innerHTML = `
                <img src="test.jpg" alt="Test image">
                <input type="text" name="test">
                <br>
                <hr>
            `;

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /img.*src=test\.jpg.*alt="Test image"/);
            assert.match(result.snapshot, /input.*type=text.*name=test/);
            assert.match(result.snapshot, /br/);
            assert.match(result.snapshot, /hr/);
        });

        it("should handle empty elements", () => {
            document.body.innerHTML = `
                <div></div>
                <span></span>
                <p></p>
            `;

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /No visible elements found/);
        });

        it("should handle custom elements", () => {
            document.body.innerHTML = '<custom-element attribute="value">Custom content</custom-element>';

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /custom-element.*"Custom content"/);
        });

        it("should handle elements with test attributes", () => {
            document.body.innerHTML = `
                <div></div>
                <div data-testid="empty-but-important"></div>
            `;

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /div.*data-testid=empty-but-important/);
        });

        it("should handle boolean attributes", () => {
            document.body.innerHTML = `
                <input type="checkbox" required disabled readonly>
                <option selected>Test</option>
            `;

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /required/);
            assert.match(result.snapshot, /disabled/);
            assert.match(result.snapshot, /readonly/);
        });

        it("should handle document with no body", () => {
            const originalBody = document.body;
            document.body.remove();

            const result = captureDomSnapshotInBrowser();

            assert.match(result.snapshot, /# No visible elements found/);

            document.documentElement.appendChild(originalBody);
        });
    });

    describe("end-to-end snapshot format", () => {
        it("should produce exact snapshot format for realistic markup", () => {
            document.body.innerHTML = `
                <div class="app">
                    <h1>Todo App</h1>
                    <form data-testid="todo-form">
                        <input type="text" placeholder="Add todo..." name="todo">
                        <button type="submit">Add</button>
                    </form>
                    <ul class="todo-list">
                        <li class="todo-item">
                            <input type="checkbox">
                            <span>Buy groceries</span>
                        </li>
                    </ul>
                </div>
            `;

            const input = document.querySelector('input[name="todo"]') as HTMLInputElement;
            input.value = "Walk the dog";
            input.focus();

            const result = captureDomSnapshotInBrowser();

            // Eveverything is @hidden, because jsdom doesn't have offsetWidth/offsetHeight
            const expected = `- body[@hidden]:
 - div.app[@hidden]:
  - h1[@hidden] "Todo App"
  - form[data-testid=todo-form @hidden]:
   - input[type=text placeholder="Add todo..." name=todo @focused @value="Walk the dog" @hidden]
   - button[type=submit @hidden] "Add"
  - ul.todo-list[@hidden]:
   - li.todo-item[@hidden]:
    - input[type=checkbox @hidden]
    - span[@hidden] "Buy groceries"`;

            assert.deepEqual(result.snapshot.split("\n"), expected.split("\n"));
        });
    });
});
