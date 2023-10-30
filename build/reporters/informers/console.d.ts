export = ConsoleInformer;
declare class ConsoleInformer extends BaseInformer {
    log(message: any): void;
    warn(message: any): void;
    error(message: any): void;
    end(message: any): void;
}
import BaseInformer = require("./base");
