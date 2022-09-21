import _ from 'lodash';
import Bluebird from 'bluebird';
import {EventEmitter} from 'events';

import {waitForResults} from '../../promise-utils';

export default class AsyncEmitter extends EventEmitter {
    emitAndWait<T>(event: string | symbol, ...args: Array<T>) {
        return _(this.listeners(event) as Array<(...args: Array<T>) => void>)
            .map((l) => (Bluebird.method(l) as (...args: Array<T>) => Bluebird<any>).apply(this, args))
            .thru(waitForResults)
            .value();
    }
};
