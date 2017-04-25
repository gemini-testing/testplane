global.assert.calledOnceWith = function() {
    assert.called(arguments[0]);
    assert.calledWith.apply(null, arguments);
};
