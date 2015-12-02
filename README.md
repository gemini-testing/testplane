WebdriverIO
===========

## Установка

```shell
npm i e2e-runner --registry http://npm.yandex-team.ru --save-dev
```

## Запуск тестов

```shell
e2e -h
```

## Кастомный исполняемый конфигурационный файл

В кастомной конфигурации задаются свои дефолныте значения параметров запуска.
Также нужно задать массивы ```capabilities``` и ```specs```
Кастомный конфиг исполняемый, можно конфигурировать запуск тестов так, как захочется


```javascript
var getBrowser = require('./lib/browsers');

module.exports = {

    /**
     * Пути к исполняемым тестам
     */
    specs: ['./tests'],

    /**
     * Набор браузеров, в которых будут запущены тесты
     */
    capabilities: [
        getBrowser('desktop-firefox')
    ],

    /**
     * Кастомизация webdriverIO.
     * Тут можно добавить кастомные команды, провести любые доп. манипуляции с драйвером.
     * Выполняется перед запуском теста
     */
    prepareEnvironment: function (browser) {
        var chai = require('chai'),
            chaiAsPromised = require('chai-as-promised');

        chai.config.includeStack = true;
        chai.use(chaiAsPromised);

        global.assert = chai.assert;
        global.PO = require('bem-page-object');

        //browser.addCommand(...)
    }
};
```

## Пример запуска

```shell
e2e test --conf ./conf.js --baseUrl http://yandex.ru/search
```
