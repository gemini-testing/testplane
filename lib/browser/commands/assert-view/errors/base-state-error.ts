//TODO
export default class BaseStateError extends Error {
    constructor(
        public stateName: string,
        public currImg: object = {},
        public refImg: object = {}
    ) {
        super();

        this.name = this.constructor.name;
    }
};
