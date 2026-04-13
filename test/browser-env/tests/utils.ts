import { CaptureSpec } from "../../../src/browser/client-scripts/screen-shooter/types";

export function visualizeCaptureSpecs(specs: CaptureSpec<"viewport", "css">[]): void {
    specs.forEach((spec, i) => {
        // Full area — green
        const fullDiv = document.createElement("div");
        fullDiv.style.position = "fixed";
        fullDiv.style.left = `${spec.full.left}px`;
        fullDiv.style.top = `${spec.full.top}px`;
        fullDiv.style.width = `${spec.full.width}px`;
        fullDiv.style.height = `${spec.full.height}px`;
        fullDiv.style.backgroundColor = "rgba(0, 255, 0, 0.3)";
        fullDiv.style.outline = "1px solid green";
        fullDiv.style.zIndex = "99999";
        fullDiv.style.pointerEvents = "none";
        fullDiv.dataset.captureArea = String(i);
        document.body.appendChild(fullDiv);

        // Visible area — blue
        const visDiv = document.createElement("div");
        visDiv.style.position = "fixed";
        visDiv.style.left = `${spec.visible.left}px`;
        visDiv.style.top = `${spec.visible.top}px`;
        visDiv.style.width = `${spec.visible.width}px`;
        visDiv.style.height = `${spec.visible.height}px`;
        visDiv.style.backgroundColor = "rgba(0, 100, 255, 0.3)";
        visDiv.style.outline = "1px dashed blue";
        visDiv.style.zIndex = "99999";
        visDiv.style.pointerEvents = "none";
        visDiv.dataset.visibleArea = String(i);
        document.body.appendChild(visDiv);
    });
}

export function visualizeSafeArea(top: number, height: number): void {
    const safeDiv = document.createElement("div");
    safeDiv.style.position = "fixed";
    safeDiv.style.left = "0";
    safeDiv.style.top = `${top}px`;
    safeDiv.style.width = "100vw";
    safeDiv.style.height = `${height}px`;
    safeDiv.style.backgroundColor = "rgba(0, 200, 120, 0.2)";
    safeDiv.style.outline = "3px solid rgba(0, 160, 100, 0.95)";
    safeDiv.style.zIndex = "2147483645";
    safeDiv.style.pointerEvents = "none";
    safeDiv.dataset.safeArea = "1";
    document.body.appendChild(safeDiv);
}
