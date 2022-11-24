// TODO: remove when own suite/test entities will be used
module.exports = class MochaFixups {
    static init(Mocha) {
        if (MochaFixups.inited_) {
            return;
        }

        MochaFixups.inited_ = true;

        MochaFixups.allowIdRewrite(Mocha.Suite.prototype, 'addSuite');
        MochaFixups.allowIdRewrite(Mocha.Suite.prototype, 'addTest');
    }

    static allowIdRewrite(proto, method) {
        const originalMethod = proto[method];

        proto[method] = function(runnable) {
            return originalMethod.call(this, new Proxy(runnable, {
                get(target, prop) {
                    return prop === 'id' ? target['__id'] : target[prop];
                },
                set(target, prop, val) {
                    target[prop === 'id' ? '__id' : prop] = val;
                    return true;
                }
            }));
        };
    }

    static inited_ = false;
};
