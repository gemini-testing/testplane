export = NewBrowser;
declare class NewBrowser extends Browser {
    init(): Promise<this>;
    reset(): Promise<void>;
    quit(): Promise<void>;
    _createSession(): Promise<WebdriverIO.Browser>;
    _setPageLoadTimeout(): Promise<void>;
    _getSessionOpts(): {
        protocol: any;
        hostname: any;
        port: number;
        path: any;
        queryParams: {
            [k: string]: string;
        };
        capabilities: any;
        automationProtocol: any;
        connectionRetryTimeout: any;
        connectionRetryCount: number;
        baseUrl: any;
        waitforTimeout: any;
        waitforInterval: any;
    };
    _extendCapabilities(config: any): any;
    _addHeadlessCapability(headless: any, capabilities: any): any;
    _extendCapabilitiesByVersion(): any;
    _getGridHost(url: any): any;
    _getQueryParams(query: any): {
        [k: string]: string;
    };
}
import Browser = require("./browser");
