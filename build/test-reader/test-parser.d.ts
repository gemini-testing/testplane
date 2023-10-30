export class TestParser extends EventEmitter {
    loadFiles(files: any, config: any): Promise<void>;
    parse(files: any, { browserId, config, grep }: {
        browserId: any;
        config: any;
        grep: any;
    }): any;
    #private;
}
import { EventEmitter } from "events";
