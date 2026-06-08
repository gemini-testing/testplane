import { BiDiNetworkCookie } from "../modules/network";
import { BiDiStoragePartitionKey } from "../modules/storage";

// storage.DeleteCookiesResult
export type BiDiStorageDeleteCookiesResult = {
    partitionKey: BiDiStoragePartitionKey;
};

// storage.GetCookiesResult
export type BiDiStorageGetCookiesResult = {
    cookies: BiDiNetworkCookie[];
    partitionKey: BiDiStoragePartitionKey;
};

// storage.SetCookieResult
export type BiDiStorageSetCookieResult = {
    partitionKey: BiDiStoragePartitionKey;
};

// StorageResult
export type BiDiStorageResult =
    | BiDiStorageDeleteCookiesResult
    | BiDiStorageGetCookiesResult
    | BiDiStorageSetCookieResult;
