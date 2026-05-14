"use strict";

const restoreStateCommand = require("src/browser/commands/restoreState").default;
const { DEVTOOLS_PROTOCOL, WEBDRIVER_PROTOCOL } = require("src/constants/config");
const { mkSessionStub_ } = require("../utils");

describe('"restoreState" command', () => {
    const sandbox = sinon.createSandbox();

    const mkBrowser_ = ({ session, automationProtocol = WEBDRIVER_PROTOCOL } = {}) => ({
        publicAPI: session,
        config: {
            automationProtocol,
            isolation: false,
            stateOpts: {
                cookies: true,
                localStorage: true,
                sessionStorage: true,
            },
        },
    });

    const initWebdriverSession_ = ({ isBidi = false } = {}) => {
        const session = mkSessionStub_();
        session.getUrl.resolves("https://example.com/page");
        session.isBidi = isBidi;
        session.setCookies = sandbox.stub().named("setCookies").resolves();
        session.refresh = sandbox.stub().named("refresh").resolves();

        restoreStateCommand(mkBrowser_({ session }));

        return session;
    };

    const initDevtoolsSession_ = () => {
        const session = mkSessionStub_();
        const page = {
            setCookie: sandbox.stub().named("setCookie").resolves(),
            frames: sandbox.stub().named("frames").returns([]),
            reload: sandbox.stub().named("reload").resolves(),
            target: sandbox.stub().named("target").returns({ _targetId: "active-target" }),
        };

        session.getUrl.resolves("https://example.com/page");
        session.getWindowHandle = sandbox.stub().named("getWindowHandle").resolves("active-target");
        session.getPuppeteer.resolves({
            pages: sandbox.stub().named("pages").resolves([page]),
        });

        restoreStateCommand(mkBrowser_({ session, automationProtocol: DEVTOOLS_PROTOCOL }));

        return { page, session };
    };

    afterEach(() => sandbox.restore());

    it("should normalize cookie prefix constraints before webdriver restore", async () => {
        const session = initWebdriverSession_();
        const hostCookie = {
            name: "__Host-csrf-token",
            value: "host-value",
            domain: "www.chromatic.com",
            path: "/custom",
            secure: false,
            httpOnly: true,
            sameSite: "Lax",
            expires: 12345,
        };
        const secureCookie = {
            name: "__Secure-session",
            value: "secure-value",
            domain: "www.chromatic.com",
            path: "/auth",
            secure: false,
            sameSite: "Strict",
        };
        const ordinaryCookie = {
            name: "regular",
            value: "regular-value",
            domain: "www.chromatic.com",
            path: "/custom",
            secure: false,
            httpOnly: true,
            sameSite: "Lax",
        };

        await session.restoreState({
            data: { cookies: [hostCookie, secureCookie, ordinaryCookie] },
            cookies: true,
            refresh: false,
        });

        assert.calledOnce(session.setCookies);
        assert.deepEqual(session.setCookies.firstCall.args[0], [
            {
                name: "__Host-csrf-token",
                value: "host-value",
                path: "/",
                secure: true,
                httpOnly: true,
                sameSite: "Lax",
                expires: 12345,
            },
            {
                name: "__Secure-session",
                value: "secure-value",
                domain: "www.chromatic.com",
                path: "/auth",
                secure: true,
                sameSite: "Strict",
            },
            ordinaryCookie,
        ]);
        assert.property(hostCookie, "domain");
    });

    it("should keep webdriver sameSite/BiDi normalization", async () => {
        const session = initWebdriverSession_({ isBidi: true });

        await session.restoreState({
            data: {
                cookies: [
                    {
                        name: "same-site-none",
                        value: "value",
                        secure: false,
                        sameSite: "None",
                    },
                ],
            },
            cookies: true,
            refresh: false,
        });

        assert.calledOnceWith(session.setCookies, [
            {
                name: "same-site-none",
                value: "value",
                secure: true,
                sameSite: "none",
            },
        ]);
    });

    it("should normalize cookie prefix constraints before devtools restore", async () => {
        const { page, session } = initDevtoolsSession_();
        const ordinaryCookie = {
            name: "regular",
            value: "regular-value",
            domain: "www.chromatic.com",
            path: "/custom",
            secure: false,
            sameSite: "Lax",
        };

        await session.restoreState({
            data: {
                cookies: [
                    {
                        name: "__Host-csrf-token",
                        value: "host-value",
                        domain: "www.chromatic.com",
                        path: "/custom",
                        secure: false,
                    },
                    {
                        name: "__Secure-session",
                        value: "secure-value",
                        domain: "www.chromatic.com",
                        path: "/auth",
                        secure: false,
                    },
                    ordinaryCookie,
                ],
            },
            cookies: true,
            refresh: false,
        });

        assert.calledOnce(page.setCookie);
        assert.deepEqual(page.setCookie.firstCall.args, [
            {
                name: "__Host-csrf-token",
                value: "host-value",
                path: "/",
                secure: true,
            },
            {
                name: "__Secure-session",
                value: "secure-value",
                domain: "www.chromatic.com",
                path: "/auth",
                secure: true,
            },
            ordinaryCookie,
        ]);
    });

    it("should not ignore unrelated cookie restore errors", async () => {
        const session = initWebdriverSession_();
        const error = new Error("unable to set cookie");

        session.setCookies.rejects(error);

        await assert.isRejected(
            session.restoreState({
                data: {
                    cookies: [
                        {
                            name: "invalid-cookie",
                            value: "value",
                        },
                    ],
                },
                cookies: true,
                refresh: false,
            }),
            /unable to set cookie/,
        );
    });
});
