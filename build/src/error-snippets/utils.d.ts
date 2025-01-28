interface FormatFileNameHeaderOpts {
    line: number;
    linesAbove: number;
    linesBelow: number;
}
interface FormatErrorSnippetOpts {
    file: string;
    source: string;
    location: {
        line: number;
        column: number;
    };
}
export declare const shouldNotAddCodeSnippet: (err: Error) => boolean;
export declare const formatFileNameHeader: (fileName: string, opts: FormatFileNameHeaderOpts) => string;
export declare const formatErrorSnippet: (error: Error, { file, source, location }: FormatErrorSnippetOpts) => string;
export declare const getSourceCodeFile: (fileName: string) => Promise<string>;
export {};
