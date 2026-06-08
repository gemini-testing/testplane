import { BiDiBrowserCommand } from "./browser-command";
import { BiDiBrowsingContextCommand } from "./browsing-context-command";
import { BiDiEmulationCommand } from "./emulation-command";
import { BiDiInputCommand } from "./input-command";
import { BiDiNetworkCommand } from "./network-command";
import { BiDiScriptCommand } from "./script-command";
import { BiDiSessionCommand } from "./session-command";
import { BiDiStorageCommand } from "./storage-command";
import { BiDiWebExtensionCommand } from "./web-extension-command";

export * from "./browser-command";
export * from "./browsing-context-command";
export * from "./emulation-command";
export * from "./input-command";
export * from "./network-command";
export * from "./script-command";
export * from "./session-command";
export * from "./storage-command";
export * from "./web-extension-command";

// CommandData
export type BiDiCommandData =
    | BiDiBrowserCommand
    | BiDiBrowsingContextCommand
    | BiDiEmulationCommand
    | BiDiInputCommand
    | BiDiNetworkCommand
    | BiDiScriptCommand
    | BiDiSessionCommand
    | BiDiStorageCommand
    | BiDiWebExtensionCommand;
