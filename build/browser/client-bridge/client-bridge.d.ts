export = ClientBridge;
declare class ClientBridge {
    static create(browser: any, script: any): import("./client-bridge");
    constructor(browser: any, script: any);
    _browser: any;
    _script: any;
    call(name: any, args?: any[]): any;
    _callCommand(command: any, injectAllowed: any): any;
    _clientMethodCommand(name: any, args: any): string;
    _guardClientCall(call: any): string;
    _inject(): any;
}
