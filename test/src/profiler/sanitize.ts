import path from "node:path";

import { ProfilerSanitizer } from "src/profiler/sanitize";

describe("profiler/sanitizer", () => {
    const sanitizer = new ProfilerSanitizer(process.cwd());
    const sanitize = <T>(value: T): Readonly<T> => {
        const sanitized = sanitizer.sanitizeResult(
            value as unknown as Parameters<ProfilerSanitizer["sanitizeResult"]>[0],
        );

        return sanitizer.freezeResult(sanitized) as unknown as Readonly<T>;
    };

    it("should remove credentials, query and fragment from URLs", () => {
        assert.equal(
            sanitizer.url("https://user:password@example.com/path?token=secret#fragment"),
            "https://example.com/path",
        );
        assert.equal(sanitizer.url("not a url"), "<invalid-url>");
    });

    it("should keep project paths relative and hide external absolute paths", () => {
        assert.equal(sanitizer.path(path.join(process.cwd(), "test", "file.js")), "test/file.js");
        assert.match(sanitizer.path("/private/sensitive/location/file.js"), /^<external>\//);
    });

    it("should normalize plugin paths in both source and attributes", () => {
        const absolutePlugin = path.join(process.cwd(), "plugins", "acceptance.js");
        const result = sanitize({
            source: { plugin: absolutePlugin },
            attributes: { plugin: absolutePlugin },
        });

        assert.equal(result.source.plugin, "plugins/acceptance.js");
        assert.equal(result.attributes.plugin, "plugins/acceptance.js");
    });

    it("should not redact secret-like words in test names or finding observations", () => {
        const result = sanitize({
            name: "the bearer of good news should validate password requirements and authorization requirements",
            observation: "`Registration should validate password length` used 5s",
            entityIds: ["the bearer of good news", "should validate password requirements"],
            token: "token=top-secret",
        });

        assert.equal(
            result.name,
            "the bearer of good news should validate password requirements and authorization requirements",
        );
        assert.equal(result.observation, "`Registration should validate password length` used 5s");
        assert.deepEqual(result.entityIds, ["the bearer of good news", "should validate password requirements"]);
        assert.equal(result.token, "token=<redacted>");
    });

    it("should redact credentials from names, observations and entity ids", () => {
        const result = sanitize({
            name: "request token=visible-name-secret",
            observation: "Authorization: Bearer visible-header-secret",
            entityIds: ["cookie=visible-entity-secret; csrf=visible-csrf-secret", "access_token=visible-access-secret"],
            attributes: { authToken: "authToken:visible-auth-secret" },
            standalone: "Bearer abcdefghijklmnopqrstuvwxyz012345",
        });
        const serialized = JSON.stringify(result);

        assert.notInclude(serialized, "visible-name-secret");
        assert.notInclude(serialized, "visible-header-secret");
        assert.notInclude(serialized, "visible-entity-secret");
        assert.notInclude(serialized, "visible-csrf-secret");
        assert.notInclude(serialized, "visible-access-secret");
        assert.notInclude(serialized, "visible-auth-secret");
        assert.notInclude(serialized, "abcdefghijklmnopqrstuvwxyz012345");
        assert.include(result.name, "token=<redacted>");
        assert.equal(result.observation, "Authorization=<redacted>");
        assert.deepEqual(result.entityIds, ["cookie=<redacted>", "access_token=<redacted>"]);
        assert.equal(result.attributes.authToken, "authToken=<redacted>");
        assert.equal(result.standalone, "Bearer=<redacted>");
    });

    it("should redact whitespace-delimited and short credentials", () => {
        assert.equal(sanitizer.string("Bearer short-secret"), "Bearer=<redacted>");
        assert.equal(sanitizer.string("Bearer abcdef"), "Bearer=<redacted>");
        assert.equal(sanitizer.string("Cookie: sid=abc123; csrf=def456"), "Cookie=<redacted>");
        assert.equal(sanitizer.string("password hunter2"), "password=<redacted>");
        assert.equal(sanitizer.string("token abc123"), "token=<redacted>");
        assert.equal(sanitizer.string("Authorization Bearer short-secret"), "Authorization=<redacted>");
        assert.equal(sanitizer.string("Bearer of, =secret.jwt"), "Bearer=<redacted>");
        assert.equal(sanitizer.string("password length; =hunter2"), "password=<redacted>");
        assert.equal(sanitizer.string("authorization requirements, =Basic-secret"), "authorization=<redacted>");

        const result = sanitize({
            name: "request token abc123 and token abcdef",
            observation: "Authorization Basic dXNlcjpwYXNz and password hunter2",
            entityIds: ["Bearer of", "Bearer abcdef", "password huntertwo"],
        });
        assert.equal(result.name, "request token=<redacted> and token=<redacted>");
        assert.equal(result.observation, "Authorization=<redacted>");
        assert.deepEqual(result.entityIds, ["Bearer of", "Bearer=<redacted>", "password=<redacted>"]);
    });

    it("should distinguish credential prefixes from prose endings", () => {
        const result = sanitize({
            entityIds: [
                "Bearer of.secret.jwt",
                "Bearer of =secret.jwt",
                "password length=hunter2",
                "password length =hunter2",
                "password length`=hunter2",
                "password length `=hunter2",
                "authorization requirements=Basic-secret",
                "authorization requirements =Basic-secret",
                "authorization requirements, =Basic-secret",
                "authorization requirements;=Basic-secret",
                "password length ” =hunter2",
                "authorization requirements » :Basic-secret",
                "Bearer of › =secret.jwt",
                "token value =visible-secret",
                "Bearer of, record",
                "password length ”",
                "authorization requirements »",
                "Bearer of ›",
                "password requirements.",
                "password length.",
                "authorization requirements.",
                "`password length.` used 5s",
            ],
        });

        assert.deepEqual(result.entityIds, [
            "Bearer=<redacted>",
            "Bearer=<redacted>",
            "password=<redacted>",
            "password=<redacted>",
            "password=<redacted>",
            "password=<redacted>",
            "authorization=<redacted>",
            "authorization=<redacted>",
            "authorization=<redacted>",
            "authorization=<redacted>",
            "password=<redacted>",
            "authorization=<redacted>",
            "Bearer=<redacted>",
            "token=<redacted>",
            "Bearer of, record",
            "password length ”",
            "authorization requirements »",
            "Bearer of ›",
            "password requirements.",
            "password length.",
            "authorization requirements.",
            "`password length.` used 5s",
        ]);
    });

    it("should redact invisible credential boundaries without erasing Cookie prose", () => {
        const zeroWidthSpace = "\u200B";
        const zeroWidthNoBreakSpace = "\uFEFF";
        const credentials = [
            `pass${zeroWidthSpace}word=hunter2`,
            `password${zeroWidthSpace}=hunter2`,
            `password${zeroWidthSpace}hunter2`,
            `password length ${zeroWidthSpace}=hunter2`,
            `authorization requirements ${zeroWidthSpace}:Basic-secret`,
            `Bearer of ${zeroWidthSpace}=secret.jwt`,
            `password len${zeroWidthNoBreakSpace}gth=hunter2`,
            `Bearer o${zeroWidthNoBreakSpace}f=secret.jwt`,
            `authorization requirement${zeroWidthNoBreakSpace}s:Basic-secret`,
        ];
        const result = sanitize({ entityIds: credentials });

        for (const value of [...credentials.map(value => sanitizer.string(value)), ...result.entityIds]) {
            assert.notMatch(value, /hunter2|Basic-secret|secret\.jwt/);
            assert.include(value, "<redacted>");
        }
        assert.equal(
            sanitize({ name: "should shrink from bottom for cookie consent bar" }).name,
            "should shrink from bottom for cookie=<redacted> bar",
        );
        assert.equal(
            sanitize({ name: "Cookie banner; retries=2 should be visible" }).name,
            "Cookie=<redacted>; retries=2 should be visible",
        );
    });

    it("should redact secrets and avoid getters, cycles and non-finite values in final payload", () => {
        let getterCalled = false;
        const circular: { token: string; number: number; self?: unknown } = {
            token: "token=top-secret",
            number: Infinity,
        };
        Object.defineProperty(circular, "dangerous", {
            enumerable: true,
            get: () => {
                getterCalled = true;
                return "secret";
            },
        });
        circular.self = circular;

        const result = sanitize(circular);

        assert.equal(result.token, "token=<redacted>");
        assert.isNull(result.number);
        assert.notProperty(result, "dangerous");
        assert.notProperty(result, "self");
        assert.isFalse(getterCalled);
        assert.isFrozen(result);
    });
});
