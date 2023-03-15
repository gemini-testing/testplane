const { TreeBuilder } = require("./tree-builder");

class InstructionsList {
    #instructions;

    constructor() {
        this.#instructions = [];
    }

    push(fn) {
        this.#instructions.push(fn);

        return this;
    }

    unshift(fn) {
        this.#instructions.unshift(fn);

        return this;
    }

    exec(ctx = {}) {
        const treeBuilder = (ctx.treeBuilder = new TreeBuilder());

        this.#instructions.forEach(fn => fn(ctx));

        return treeBuilder.applyFilters().getRootSuite();
    }
}

module.exports = {
    InstructionsList,
};
