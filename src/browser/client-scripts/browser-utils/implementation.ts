import * as lib from "@lib";

export function resetZoom(): void {
    let meta = lib.queryFirst('meta[name="viewport"]') as HTMLMetaElement;
    if (!meta) {
        meta = document.createElement("meta");
        meta.name = "viewport";

        const head = lib.queryFirst("head");
        head && head.appendChild(meta);
    }
    meta.content = "width=device-width,initial-scale=1.0,user-scalable=no";
}
