import {
    BiDiScriptChannel,
    BiDiScriptRealm,
    BiDiScriptRealmInfo,
    BiDiScriptRemoteValue,
    BiDiScriptSource,
} from "../modules/script";

// script.Message
export type BiDiScriptMessageEvent = {
    method: "script.message";
    params: BiDiScriptMessageParameters;
};

// script.MessageParameters
export type BiDiScriptMessageParameters = {
    channel: BiDiScriptChannel;
    data: BiDiScriptRemoteValue;
    source: BiDiScriptSource;
};

// script.RealmCreated
export type BiDiScriptRealmCreatedEvent = {
    method: "script.realmCreated";
    params: BiDiScriptRealmInfo;
};

// script.RealmDestroyed
export type BiDiScriptRealmDestroyedEvent = {
    method: "script.realmDestroyed";
    params: BiDiScriptRealmDestroyedParameters;
};

// script.RealmDestroyedParameters
export type BiDiScriptRealmDestroyedParameters = {
    realm: BiDiScriptRealm;
};

// ScriptEvent
export type BiDiScriptEvent = BiDiScriptMessageEvent | BiDiScriptRealmCreatedEvent | BiDiScriptRealmDestroyedEvent;
