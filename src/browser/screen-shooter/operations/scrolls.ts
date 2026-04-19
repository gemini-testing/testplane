import { ClientBridge } from "../../client-bridge";
import type * as browserSideScreenshooterImplementation from "../../client-scripts/screen-shooter/implementation";

type BrowserSideScreenshooter = ClientBridge<typeof browserSideScreenshooterImplementation>;

export async function cleanupScrolls(screenshooter: BrowserSideScreenshooter): Promise<void> {
    await screenshooter.call("cleanupScrolls", []);
}
