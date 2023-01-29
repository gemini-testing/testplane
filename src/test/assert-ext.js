global.assert.calledOnceWith = function () {
    assert.calledOnce(arguments[0]);
    assert.calledWith.apply(null, arguments);
};

global.assert.calledOnceWithExactly = function () {
    assert.calledOnce(arguments[0]);
    assert.calledWithExactly.apply(null, arguments);
};
