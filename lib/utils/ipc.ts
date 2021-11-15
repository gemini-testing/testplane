import _ from 'lodash';

export default {
    emit: (event: string, data: object = {}): boolean => {
        if (process.send) {
            return process.send({event, ...data});
        }

        return false;
    },
    on: (event: string, baseHandler: (...args: Array<any>) => any): void => {
        process.on('message', (...args: [object, ...any]) => {
            if (event !== _.get(args[0], 'event')) {
                return;
            }

            baseHandler(...args);
        });
    }
};
