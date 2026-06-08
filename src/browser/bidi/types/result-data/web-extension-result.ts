import { BiDiEmptyResult } from "../generic";
import { BiDiWebExtensionExtension } from "../modules/web-extension";

// webExtension.InstallResult
export type BiDiWebExtensionInstallResult = {
    extension: BiDiWebExtensionExtension;
};

// webExtension.UninstallResult
export type BiDiWebExtensionUninstallResult = BiDiEmptyResult;

// WebExtensionResult
export type BiDiWebExtensionResult = BiDiWebExtensionInstallResult | BiDiWebExtensionUninstallResult;
