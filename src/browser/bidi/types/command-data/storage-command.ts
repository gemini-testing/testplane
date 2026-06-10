import { JsUInt } from "../generic";
import { BiDiBrowsingContextBrowsingContext } from "../modules/browsing-context";
import { BiDiNetworkBytesValue, BiDiNetworkSameSite } from "../modules/network";

// storage.GetCookies
export type BiDiStorageGetCookiesCommand = {
    method: "storage.getCookies";
    params: BiDiStorageGetCookiesParameters;
};

// storage.CookieFilter
export type BiDiStorageCookieFilter = {
    name?: string;
    value?: BiDiNetworkBytesValue;
    domain?: string;
    path?: string;
    size?: JsUInt;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: BiDiNetworkSameSite;
    expiry?: JsUInt;
};

// storage.BrowsingContextPartitionDescriptor
export type BiDiStorageBrowsingContextPartitionDescriptor = {
    type: "context";
    context: BiDiBrowsingContextBrowsingContext;
};

// storage.StorageKeyPartitionDescriptor
export type BiDiStorageStorageKeyPartitionDescriptor = {
    type: "storageKey";
    userContext?: string;
    sourceOrigin?: string;
};

// storage.PartitionDescriptor
export type BiDiStoragePartitionDescriptor =
    | BiDiStorageBrowsingContextPartitionDescriptor
    | BiDiStorageStorageKeyPartitionDescriptor;

// storage.GetCookiesParameters
export type BiDiStorageGetCookiesParameters = {
    filter?: BiDiStorageCookieFilter;
    partition?: BiDiStoragePartitionDescriptor;
};

// storage.SetCookie
export type BiDiStorageSetCookieCommand = {
    method: "storage.setCookie";
    params: BiDiStorageSetCookieParameters;
};

// storage.PartialCookie
export type BiDiStoragePartialCookie = {
    name: string;
    value: BiDiNetworkBytesValue;
    domain: string;
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: BiDiNetworkSameSite;
    expiry?: JsUInt;
};

// storage.SetCookieParameters
export type BiDiStorageSetCookieParameters = {
    cookie: BiDiStoragePartialCookie;
    partition?: BiDiStoragePartitionDescriptor;
};

// storage.DeleteCookies
export type BiDiStorageDeleteCookiesCommand = {
    method: "storage.deleteCookies";
    params: BiDiStorageDeleteCookiesParameters;
};

// storage.DeleteCookiesParameters
export type BiDiStorageDeleteCookiesParameters = {
    filter?: BiDiStorageCookieFilter;
    partition?: BiDiStoragePartitionDescriptor;
};

// StorageCommand
export type BiDiStorageCommand =
    | BiDiStorageDeleteCookiesCommand
    | BiDiStorageGetCookiesCommand
    | BiDiStorageSetCookieCommand;
