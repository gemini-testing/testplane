declare function getLogger(): typeof console;
declare namespace getLogger {
    var setLogLevelsConfig: () => void;
}
export default getLogger;
