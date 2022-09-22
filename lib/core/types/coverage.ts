import type {CoverageValue} from '../coverage/coverage-level';

export interface CoverageError {
    ignored: boolean;
    message: string;
}

export interface CoverageByUrl {
    [url: string]: CoverageValue;
}

export interface Coverage {
    [prop: string]: CoverageError | CoverageByUrl;
}
