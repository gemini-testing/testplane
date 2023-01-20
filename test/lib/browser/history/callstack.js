'use strict';

const Callstack = require('lib/browser/history/callstack');
const {historyDataMap} = require('lib/browser/history/utils');

describe('commands-history', () => {
    describe('callstack', () => {
        let stack;

        beforeEach(() => {
            stack = new Callstack();
        });

        it('should create a default data structure for a node', () => {
            stack.enter();
            stack.leave();

            const [node] = stack.release();

            assert.property(node, 'c');
            assert.property(node, 'ts');
            assert.property(node, 'te');
            assert.property(node, 'd');
        });

        it('should build a linear history', () => {
            stack.enter();
            stack.leave();
            stack.enter();
            stack.leave();

            const nodes = stack.release();

            assert.equal(nodes.length, 2);
            assert.deepEqual(nodes[0].c, []);
            assert.deepEqual(nodes[1].c, []);
        });

        it('should build a nested history', () => {
            stack.enter();
            stack.leave();
            stack.enter();
            stack.enter();
            stack.leave();
            stack.leave();

            const nodes = stack.release();

            assert.propertyVal(nodes, 'length', 2);
            assert.deepNestedPropertyVal(nodes, '0.c', []);
            assert.nestedPropertyVal(nodes, '1.c.length', 1);
            assert.deepNestedPropertyVal(nodes, '1.c.0.c', []);
        });

        it('should clean a history after release', () => {
            stack.enter();
            stack.leave();

            assert.propertyVal(stack.release(), 'length', 1);
            assert.propertyVal(stack.release(), 'length', 0);
        });

        it('should extend a node with a passed data', () => {
            stack.enter({some: 'data'});
            stack.leave();

            const [node] = stack.release();

            assert.propertyVal(node, 'some', 'data');
        });

        it('should remove child nodes when parent leaves a stack', () => {
            stack.enter({[historyDataMap.KEY]: 2});
            stack.enter({[historyDataMap.KEY]: 3});

            stack.leave(2);

            const nodes = stack.release();
            assert.equal(nodes.length, 1);
        });

        it('should ignore "leave" command on empty stack', () => {
            stack.leave();

            const nodes = stack.release();
            assert.equal(nodes.length, 0);
        });

        it('should calculate a duration properly', () => {
            const clock = sinon.useFakeTimers();

            clock.tick(1);
            stack.enter();
            clock.tick(5);
            stack.leave();

            const [node] = stack.release();

            assert.propertyVal(node, 'ts', 1);
            assert.propertyVal(node, 'te', 6);
            assert.propertyVal(node, 'd', 5);

            clock.restore();
        });

        it('should mark error all parent nodes', () => {
            stack.enter();
            stack.enter();
            stack.enter();
            stack.leave();
            stack.enter();
            stack.leave();
            stack.leave();
            stack.leave();

            stack.markError(() => true);

            const nodes = stack.release();
            assert.nestedPropertyVal(nodes, '0.f', true);
            assert.nestedPropertyVal(nodes, '0.c.0.f', true);
            assert.notNestedPropertyVal(nodes, '0.c.0.c.0.f');
            assert.nestedPropertyVal(nodes, '0.c.0.c.1.f', true);
        });

        it('should mark error only parent node', () => {
            stack.enter();
            stack.enter();
            stack.leave();
            stack.leave();

            stack.markError(() => false);

            const nodes = stack.release();
            assert.nestedPropertyVal(nodes, '0.f', true);
            assert.notNestedPropertyVal(nodes, '0.c.0.f');
        });
    });
});
