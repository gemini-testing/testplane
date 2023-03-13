import 'chai-as-promised';
import Assert = Chai.Assert; // eslint-disable-line no-undef
import {SinonAssert} from 'sinon';


declare global {
    const assert: typeof import('chai').assert & SinonAssert & Assert &
        { calledOnceWith(...args: any[]): boolean };
}
