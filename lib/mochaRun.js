var Mocha = require('mocha'),
    vow = require('vow');

module.exports = function runMocha(runData) {

    var defer = vow.defer(),
        mocha = new Mocha({
            reporter: runData.options.reporter,
            timeout: runData.options.timeout,
            useColors: true,
            slow: runData.options.slow
        });

    runData.options.tests.forEach(mocha.addFile.bind(mocha));

    mocha.run(function(failures) {
        if(failures) {
            defer.reject(failures);
        } else {
            defer.resolve();
        }
    });

    return defer.promise();
};
