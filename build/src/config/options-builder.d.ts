declare function _exports(defaultFactory: any): {
    boolean: (name: any, opts?: {
        isDeprecated: boolean;
    }) => configparser.Parser<any>;
    optionalBoolean: (name: any) => configparser.Parser<any>;
    optionalArray: (name: any) => configparser.Parser<any>;
    optionalObject: (name: any) => configparser.Parser<any>;
    optionalFunction: (name: any) => configparser.Parser<any>;
    anyObject: () => any;
    nonNegativeInteger: (name: any) => configparser.Parser<any>;
    optionalNonNegativeInteger: (name: any, opts?: {
        isDeprecated: boolean;
    }) => configparser.Parser<any>;
    string: (name: any) => configparser.Parser<any>;
    optionalString: (name: any) => configparser.Parser<any>;
    positiveInteger: (name: any) => configparser.Parser<any>;
    positiveIntegerOrInfinity: (name: any) => configparser.Parser<any>;
    stringOrFunction: (name: any) => configparser.Parser<any>;
    hexString: (name: any) => configparser.Parser<any>;
    enumeration: (name: any, enumValues: any, customOptionConfig: any) => configparser.Parser<any>;
};
export = _exports;
