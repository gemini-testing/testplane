var Mocha = require('mocha'),
    Q = require('q');

module.exports = function(runData) {
    return Q.Promise(function(resolve, reject) {
        var mocha = new Mocha({
            reporter: runData.options.reporter,
            timeout: runData.options.timeout,
            useColors: true,
            slow: runData.options.slow
        });

        runData.options.tests.forEach(mocha.addFile.bind(mocha));

        mocha.run(function(failures) {
            if (failures) {
                reject(failures);
            } else {
                resolve();
            }
        });
    });
};
