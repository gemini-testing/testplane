export function isSafariMobile(): boolean {
    return Boolean(
        navigator &&
            typeof navigator.vendor === "string" &&
            navigator.vendor.match(/apple/i) &&
            /(iPhone|iPad).*AppleWebKit.*Safari/i.test(navigator.userAgent)
    );
}
