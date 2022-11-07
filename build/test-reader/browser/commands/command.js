module.exports = class BaseCommand {
    execute() {
        throw new Error('not implemented');
    }
    handleTest() {
        throw new Error('not implemented');
    }
    handleSuite() {
        throw new Error('not implemented');
    }
};
