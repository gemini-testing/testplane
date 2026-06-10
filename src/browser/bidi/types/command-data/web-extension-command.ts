import { BiDiWebExtensionExtension } from "../modules/web-extension";

// webExtension.Install
export type BiDiWebExtensionInstallCommand = {
    method: "webExtension.install";
    params: BiDiWebExtensionInstallParameters;
};

// webExtension.InstallParameters
export type BiDiWebExtensionInstallParameters = {
    extensionData: BiDiWebExtensionExtensionData;
};

// webExtension.ExtensionData
export type BiDiWebExtensionExtensionData =
    | BiDiWebExtensionExtensionArchivePath
    | BiDiWebExtensionExtensionBase64Encoded
    | BiDiWebExtensionExtensionPath;

// webExtension.ExtensionPath
export type BiDiWebExtensionExtensionPath = {
    type: "path";
    path: string;
};

// webExtension.ExtensionArchivePath
export type BiDiWebExtensionExtensionArchivePath = {
    type: "archivePath";
    path: string;
};

// webExtension.ExtensionBase64Encoded
export type BiDiWebExtensionExtensionBase64Encoded = {
    type: "base64";
    value: string;
};

// webExtension.Uninstall
export type BiDiWebExtensionUninstallCommand = {
    method: "webExtension.uninstall";
    params: BiDiWebExtensionUninstallParameters;
};

// webExtension.UninstallParameters
export type BiDiWebExtensionUninstallParameters = {
    extension: BiDiWebExtensionExtension;
};

// WebExtensionCommand
export type BiDiWebExtensionCommand = BiDiWebExtensionInstallCommand | BiDiWebExtensionUninstallCommand;
