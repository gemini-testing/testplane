# Предварительная проверка пропущенного await: план реализации

## Задача

Добавить в Testplane включённый по умолчанию статический preflight для известных асинхронных browser/element-команд. До выполнения начальной коллекции остановить запуск при найденных потерянных ожиданиях, вывести все места с file:line:column и существующим code frame. JS/TS не должны требовать tsconfig, ESLint или выполнения тестовых callbacks.

Реализовать ровно контракт из `vibe/missing-await-preflight-research.md`: file-level проверка, консервативное распознавание bindings и команд, явные ограничения data-flow/custom commands/dynamic tests. Расширенный контракт согласован пользователем 2026-11-06; реализация выполняется по этому плану.

## Структура плана

Анализатор → его тесты → диагностика и файловый валидатор → их тесты → конфигурация и барьер запуска → тесты интеграции раннера → сквозные проверки → документация и финальная проверка.

Все команды выполнять из корня отдельного worktree `/Users/sipayrt/.codex/worktrees/missing-await-clean/testplane` на ветке `sp.missing-await-preflight`. База: актуальный `origin/master`, `24b75263d4fddfbb8260f5864409597a54cb7ff9` (Testplane 9.4.0). Ветку разработки зависимостей не использовать как базу. Перед исполнением создать `vibe/missing-await-preflight-plan-track.md` с [ ]/[X] для восьми этапов. Не менять основной checkout и не выполнять arc-команды: это Git-репозиторий.

## Общие условия реализации

- Node.js >=22 из package.json; контрольный прогон также на Node 24 из .nvmrc.
- Не исполнять исходники в анализаторе; не создавать браузер; создавать TypeScript Program/TypeChecker без emit и без запуска пользовательского кода.
- Не переносить INIT/beforeAll/discovery относительно существующих публичных событий.
- Не обещать проверку до запуска workers/dev-server: барьер находится перед RUNNER_START.
- Сохранять runtime stacktrace/unhandled-rejection handling.
- Тестировать публичные функции и поведение, не private-методы.
- UTF-8, LF, newline в конце, без trailing whitespace.
- Интерфейсы ниже внутренние; не добавлять их в публичные exports пакета.

### Этап 1: Реализовать AST-анализатор и каталог команд

**Что добавить/реализовать:**

- Перенести установленный `typescript@5.3.2` из devDependencies в dependencies. Использовать TypeScript AST и TypeChecker вместе: это исключает второй parser и сопоставление Babel/TS nodes. Существующие Babel dependencies не менять. Обновить lockfile.
- Создать `MissingAwaitDiagnostic = { code: "missing-await"; file: string; line: number; column: number; command: string; message: string }`, `AnalyzeOptions = { file: string; mochaUi?: "bdd" | "tdd" | "qunit"; program?: ts.Program }`.
- Реализовать `analyzeMissingAwait(source: string, options: AnalyzeOptions): MissingAwaitDiagnostic[]`. Разбирать оригинальный source согласно расширению; использовать getLineAndCharacterOfPosition + 1.
- Реализовать внутренний `CommandCatalog` и `createCommandCatalog(): CommandCatalog`: WDIO browser/element names, protocol descriptor.command из всех экспортированных protocol maps, Testplane API names. Исключить addCommand/overwriteCommand и event-emitter методы; action вернуть как builder, actions/perform — async.
- Явный Testplane browser-набор: assertView, clearSession, getConfig, getPuppeteer, setOrientation, scrollIntoView, openAndWait, switchToRepl, unstable_captureDomSnapshot, waitForStaticToLoad, saveState, restoreState, getState, unstable_getCdp, getMeta, setMeta, addTag, extendOptions, runStep. Element-набор: assertView, moveCursorTo, unstable_captureDomSnapshot плюс существующий WDIO element-набор.
- Использовать TypeScript symbols и lexical bindings для DSL-import aliases, callback context, destructuring, this и неизменяемых const-aliases. Не распространять this через обычную вложенную function; стрелки наследуют this.
- Распознавать element/element-array receivers и builder-переходы, перечисленные в проекте решения. Динамическое вычисление имени метода и изменяемые aliases оставлять неизвестными.
- Поддержать literal-name addCommand внутри анализируемого файла с literal attachToElement. Регистрация добавляет имя, но сама не требует await.
- Ввести классификацию результатов: unknown, browser, element, element-array, action-builder, command-promise с receiver-kind при необходимости. Promise-цепочки then/catch/finally сохраняют принадлежность к команде.
- Диагностировать отброшенные command-promise expressions, void, conditional/logical/sequence и неиспользованные Promise combinators с inline-видимыми командами. Добавить локальный data-flow сохранённых промисов, неизменяемых aliases и массивов, await/return/Promise combinators и ветвлений. Передача в неизвестный consumer считается выходом за область анализа, не доказанным ожиданием.
- Не переносить ожидание через границы callback; обходить тела вложенных callbacks отдельно. Пропускать клиентские callbacks execute/executeAsync.
- Распространять контекст discarded/awaited/returned/forwarded/unknown по правилам проекта решения. Проверять discarded-префиксы sequence даже внутри await/return; не считать unknown consumer ожидающим переданные arguments. Связь DSL с callback устанавливать только для inline function/arrow, не для произвольных ссылок на функции.
- Возвращать один diagnostic на потерянную promise-цепочку либо агрегат; anchor — начало ожидаемого внешнего выражения (для Promise.all — начало Promise.all). Независимые conditional/sequence ветви диагностировать отдельно, не дублировать внутренний $ в $().click(). На ошибке синтаксиса пробрасывать диагностику TypeScript parser.

**Файлы изменить/создать:**

- `package.json`, `package-lock.json` — зависимости.
- `src/test-reader/await-check/types.ts` — внутренние типы.
- `src/test-reader/await-check/commands.ts` — каталог и классификация команд.
- `src/test-reader/await-check/analyze.ts` — TypeScript parser, symbols, анализ использования результата.
- `src/test-reader/await-check/type-info.ts` — Program по ближайшему tsconfig либо встроенным defaults; TypeChecker для PromiseLike, массивов, импортированных helpers/custom commands.
- `src/test-reader/await-check/flow.ts` — состояния локальных bindings/обязательств, копирование/слияние ветвей.
- Статически распознанные Array.forEach с async callback и потерянные Promise[] от map диагностировать; корректный await Promise.all(map(...)) принимать. Тела импортированных helpers не обходить: их возвращаемые типы расширяют распознавание вызовов, но не доказывают корректность реализации helper.

**Документация:**

- https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API — Program/TypeChecker, AST, symbols и source locations.
- `vibe/missing-await-preflight-research.md` — полный контракт.

**Примеры в коде:**

- `src/utils/typescript.ts` — существующая загрузка/транспиляция JS/TS; не использовать её для исполнения при анализе.
- `src/browser/history/commands.ts` — command names.
- `src/browser/types.ts`, `src/browser/commands/index.ts`, `src/browser/existing-browser.ts` — Testplane-команды и регистрации.
- `src/test-reader/mocha-reader/utils.js` — стандартные Mocha UI.

**Проверка:**

- `npm run build` — успешная сборка.
- `./node_modules/.bin/eslint src/test-reader/await-check` — без ошибок.
- `./node_modules/.bin/prettier --check src/test-reader/await-check` — без ошибок.

### Этап 2: Закрепить семантику анализатора табличными unit-тестами

**Что добавить/реализовать:**

- Таблицы source → diagnostics через analyzeMissingAwait, без реального браузера и исполнения source.
- Ошибки: исходный assertView в async и non-async callbacks; this.browser; ctx.browser; destructuring rename; const-alias; $().click(); element после await; $$()[0]; optional/computed string member; then/catch/finally без ожидания; void; Promise.all/allSettled/race/any/resolve без ожидания.
- Успех: await, return, implicit-return arrow, await Promise.all, const p с последующим await, синхронные registration/event-emitter/builder calls, console/assert/render и посторонний объект с методом assertView.
- Корректные границы: вложенный runStep с потерянной командой; отдельная function и lexical arrow this; shadowed browser/it/Promise; callbacks execute/executeAsync; вложенная conditional/sequence с частично отброшенными значениями, в том числе `await (browser.url('/'), browser.assertView('x'))` — ошибка только на url; независимые ошибки в двух conditional-ветвях.
- Каталог: protocol getUrl, Testplane browser/element assertView, addTag/getConfig как async, action как sync, perform как async; literal custom registration на browser и element; неизвестная внешняя custom command не диагностируется.
- Fixtures JS/JSX/MJS/CJS/TS/TSX/MTS/CTS, decorators и TS assertion `<T>x` в .ts; UTF-8, CRLF, первая/последняя строка, отсутствие финального newline во входном пользовательском файле; точные 1-based координаты. Хранить исходники как *.fixture и читать через fs, не импортировать; CRLF и отсутствие newline создавать в памяти. Все tracked fixtures сохранять с LF и финальным newline. Настоящие JS/TS файлы для файловых тестов материализовать только во временном каталоге вне дерева test.
- Добавить положительные/отрицательные тесты сохранённых промисов, aliases, массивов, if/else/early return/try-finally, Array.forEach и map; проверять await/return на всех моделируемых нормальных выходах.
- Проверить импортированный Promise-returning helper и custom command по декларации типа, JS JSDoc, tsconfig paths, отсутствие tsconfig.
- Characterization ограничений: any/неизвестный helper, динамический method name, передача в неизвестный consumer, сложные изменяемые контейнеры/замыкания. Не объявлять эти примеры безопасными.
- Проверить, что source с throw/сетевым вызовом/side-effect marker внутри тела не исполняется.

**Файлы:**

- `test/src/test-reader/await-check/analyze.ts`.
- `test/src/test-reader/await-check/coverage.ts` — in-memory syntax/flow fixtures и реальные временные type-program fixtures; source никогда не импортировать.

**Примеры и документация:**

- `test/src/error-snippets/utils.ts` — Mocha, Sinon, assert, табличные проверки.
- `test/src/utils/typescript.ts` — fixtures преобразования синтаксиса.
- Проект решения, разделы «Синтаксис» и «Что считать потерянным ожиданием».

**Проверка:**

- `node scripts/run-node-without-type-stripping.js ./node_modules/mocha/bin/mocha.js test/src/test-reader/await-check/analyze.ts`.
- `npm run check-types`.
- `./node_modules/.bin/eslint test/src/test-reader/await-check/analyze.ts`.

### Этап 3: Реализовать файловый валидатор и агрегированную диагностику

**Что добавить/реализовать:**

- Создать discriminated union `PreflightDiagnostic`: MissingAwaitDiagnostic и diagnostics с code parse-error/read-error/unsupported-file/unsupported-ui/missing-source, file, message, необязательными line/column.
- Реализовать `validateTestCollection(collection: TestCollection, options: {mochaUi?: MochaOpts["ui"]}): Promise<void>`.
- Собрать test.file через публичный mapTests только для активных тестов с !pending && !disabled. Не добавлять hook.file: он указывает на parent suite, а не на достоверный исходник hook. Нет активных тестов — вернуть success без чтения.
- Требовать file у активных тестов. Inline-hooks в выбранном файле анализировать вместе с ним; отдельные hook-only файлы, импортированные hooks и программно внедрённые callbacks оставить за пределами статической проверки. Не изменять модель Hook и discovery ради восстановления их происхождения.
- Нормализовать абсолютные пути и file://; дедуплицировать по realpath, сохранять детерминированный display path. Не загружать URL по HTTP.
- Читать исходники последовательно, каждый файл один раз за вызов; анализировать весь файл, не вырезать выбранные по grep callbacks. Program может читать imports/декларации для типов, но не генерировать missing-await diagnostics из внешних тел.
- Преобразовать ошибки чтения/расширения/UI/синтаксиса в явные diagnostics. Обработать остальные файлы и собрать весь результат. Не использовать fallback regex и не проглатывать ошибки.
- Реализовать `TestPreflightError extends Error` с readonly diagnostics. При ошибке бросать один экземпляр после полного прохода.
- Сообщение: `Test preflight failed: N missing await error(s), M file analysis error(s). No tests were started.`; для missing-await: `Async command "<command>" is not awaited or returned. Add await or return its promise.`
- Включить file:line:column и formatErrorSnippet для каждого diagnostic с исходником/координатой; сформировать stack для существующего CLI и snippet для потребителей. Не генерировать поддельные stack frames.
- Сортировать и дедуплицировать diagnostics по file/line/column/code. Удерживать source только для файлов с диагностикой; run-local cache не переживает validateTestCollection.

**Файлы:**

- `src/test-reader/await-check/types.ts` — union.
- `src/test-reader/await-check/index.ts` — validateTestCollection.
- `src/errors/test-preflight-error.ts` — агрегированная ошибка.
- `src/error-snippets/utils.ts` — использовать существующий formatErrorSnippet без изменения его поведения.

**Примеры и документация:**

- `src/test-collection/index.ts` — mapTests.
- `src/test-reader/test-object/hook.ts`, `src/test-reader/mocha-reader/tree-builder-decorator.js` — существующие ограничения происхождения hook; не использовать hook.file как источник для расширения file-set.
- `src/error-snippets/types.ts`, `src/error-snippets/utils.ts` — snippet API.
- `src/cli/index.ts` — вывод stack и код выхода.

**Проверка:**

- `npm run build`.
- `./node_modules/.bin/eslint src/test-reader/await-check src/errors/test-preflight-error.ts`.
- Unit-команда этапа 2 — без регрессий.

### Этап 4: Проверить агрегацию, файловую область и ошибки анализа

**Что добавить/реализовать:**

- Проверить несколько ошибок в одном файле и в разных файлах, стабильный порядок, один parse для нескольких browsers/versions и symlinks.
- Проверить исходные координаты JS/TS/TSX без source maps, code frame, человекочитаемый stack, структурированный diagnostics.
- Проверить file://, ENOENT, недоступный source, syntax error, неизвестное расширение, unsupported custom/exports UI; один технический сбой не скрывает ошибки других читаемых файлов.
- Проверить отсутствие чтения для empty/all-disabled коллекции, анализ inline-hooks внутри активных test.file, отсутствие обхода внешних helper imports и hook-only файлов. Hook с file, унаследованным от parent suite, не должен расширять file-set; это characterization-тест границы, а не признание внешнего hook безопасным.
- Зафиксировать file-level политику: отфильтрованный файл не читается; невыбранный тест внутри выбранного файла проверяется.
- Два последовательных вызова валидатора после исправления файла должны перечитывать source и не сохранять старую ошибку.
- Проверять diagnostics и публичное поведение, не private helpers.

**Файлы:**

- `test/src/test-reader/await-check/index.ts`.
- `test/src/errors/test-preflight-error.ts`.
- `test/fixtures/await-check/*.fixture` — source-шаблоны ошибок и корректных форм, читаемые как данные; для валидатора создавать временные файлы с настоящими расширениями.

**Примеры и документация:**

- `test/src/error-snippets/index.ts` и `test/src/error-snippets/utils.ts`.
- `test/src/test-reader/test-parser.js` — file-level tests.

**Проверка:**

- `node scripts/run-node-without-type-stripping.js ./node_modules/mocha/bin/mocha.js test/src/test-reader/await-check test/src/errors/test-preflight-error.ts test/src/error-snippets`.
- `npm run check-types`.
- `./node_modules/.bin/eslint test/src/test-reader/await-check test/src/errors/test-preflight-error.ts`.

### Этап 5: Подключить конфигурацию и барьер выполнения коллекции

**Что добавить/реализовать:**

- Добавить system.checkMissingAwait:boolean, default true через options.boolean("checkMissingAwait"), с обычными config/env/CLI overrides.
- В MainRunner.run до browserPool.prewarm и RUNNER_START, внутри try, выполнить validateTestCollection. Динамически импортировать анализатор только при включённой проверке.
- Не выставлять runned=true до успешного preflight: addTestToRun во время ожидания проверки возвращает false. После успешной проверки сохранить порядок browserPool.prewarm → RUNNER_START → BEGIN → execution.
- На TestPreflightError до cleanup один раз синхронно эмитить MasterEvents.ERROR с тем же объектом ошибки. В Testplane._handleError добавить раннюю ветку для TestPreflightError: вызвать _fail() и вернуть управление без halt, логирования и таймера. Так END/RUNNER_END наблюдают isFailed() === true.
- На diagnostic не вызывать browserPool.prewarm/RUNNER_START/BEGIN/_runTests, не создавать BrowserRunner; сохранить cleanup master: browserPool[Symbol.asyncDispose] → END → RUNNER_END → workersRegistry.end, включая существующие таймауты и сохранение первичной ошибки. Не добавлять TEST_FAIL/TEST_BEGIN/retry.
- Сохранять первичный TestPreflightError при вторичной ошибке workersRegistry.end: вторичную записать logger.warn, наружу бросить первичную. Для остальных видов ошибок не менять прежнюю политику.
- В Testplane._run после завершения cleanup раннера перехватить только TestPreflightError вокруг runner.run: вызвать halt(error, 0, false), затем throw той же ошибки. Это выполняет EXIT/закрытие Vite после orderly cleanup; failed-state установлен раньше через ERROR. Остальные ошибки сохраняют прежний путь. Не вызывать process.exit в библиотечном API.
- Не проверять отдельно TestReader: run(paths) и run(TestCollection) должны проходить общий барьер, а list-tests/readTests оставаться discovery-only.
- Не вводить файловый кэш между run; не менять динамический addTestToRun после старта, явно оставленный вне контракта.
- Обновить makeConfigStub так, чтобы default новой опции соответствовал production; existing runner tests должны явно stub валидатор, а не обращаться к вымышленным файлам.

**Файлы:**

- `src/config/defaults.js`, `src/config/options.js`, `src/config/types.ts`.
- `src/runner/index.ts` — единственный execution gate.
- `src/testplane.ts` — ранний failed-state в _handleError и controlled abort в _run.
- `test/utils.js` — конфигурационный stub.
- `test/src/runner/index.js` — изоляция валидатора в существующих тестах.

**Примеры и документация:**

- `src/config/options-builder.js` — boolean parsing.
- `src/runner/index.ts` — cleanup browser pool, событий и workers после ошибки runner.
- `src/testplane.ts` — существующий halt(error, timeout, logError).
- `docs/events/init.md`, `docs/events/runner-start.md`, `docs/events/runner-end.md` — события.

**Проверка:**

- `npm run build`.
- `node scripts/run-node-without-type-stripping.js ./node_modules/mocha/bin/mocha.js test/src/runner/index.js test/src/testplane.js test/src/config/options.js`.
- `npm run check-types`.

### Этап 6: Проверить порядок запуска, отключение и аварийное завершение

**Что добавить/реализовать:**

- Конфигурация: default true, false, неверные типы; uppercase/lowercase TESTPLANE/HERMIONE overrides и CLI по существующим configparser-паттернам.
- Deferred Promise валидатора: до resolve ни RUNNER_START, ни BrowserRunner.addTestToRun; addTestToRun возвращает false. После resolve правильный порядок и обычный запуск.
- Reject валидатора: нет RUNNER_START/BEGIN/TEST_BEGIN, нет BrowserRunner и browser/session запросов; ERROR с исходной ошибкой идёт один раз до END/RUNNER_END, workers.end и RUNNER_END вызваны один раз.
- system.checkMissingAwait=false: валидатор не импортируется/не вызывается, старый путь сохраняется.
- API Testplane.run(paths) и run(TestCollection) получают тот же TestPreflightError; обработчики END и RUNNER_END уже видят isFailed() === true. После cleanup halt вызывается с 0 и false; нет таймера на 60 секунд и повторного внутреннего логирования. Проверять через публичные события/run, не прямым вызовом private _handleError.
- Ошибка cleanup не должна терять исходную preflight-диагностику: закрепить сохранение первичной ошибки при workers.end failure, вторичную писать через logger.warn. Для других путей сохранить прежнее поведение.
- readTests/list-tests по-прежнему работают без preflight; runtime unhandled rejection/stacktrace tests продолжают проходить.

**Файлы:**

- `test/src/config/options.js`.
- `test/src/runner/index.js`.
- `test/src/testplane.js`.
- `test/src/cli/index.js`.

**Примеры:**

- Существующие тесты «should end workers on fail» и «should not add tests ... if RUNNER_START handler failed» в `test/src/runner/index.js`.
- `test/src/cli/index.js` — process.exit/logger stubs.

**Проверка:**

- `node scripts/run-node-without-type-stripping.js ./node_modules/mocha/bin/mocha.js test/src/config/options.js test/src/runner/index.js test/src/testplane.js test/src/cli/index.js`.
- `npm run test-unit`.
- `npm run check-types`.

### Этап 7: Добавить сквозные проверки реального CLI и опубликованного пакета

**Что добавить/реализовать:**

- Создать integration fixture-projects без ESLint и tsconfig: failing JS, failing TS, failing TSX; несколько файлов/браузеров, inline beforeEach/afterEach, корректные await/return/Promise.all. Хранить source-шаблоны *.fixture в test/fixtures/await-check/integration и материализовать их с настоящими расширениями во временном каталоге ОС перед запуском child process. Не помещать исполняемые fixture-тесты под test/integration: существующий recursive Mocha glob иначе запустит их во внешнем suite.
- Запускать настоящий bin/testplane дочерним процессом с reporter, не требующим браузера для preflight failure, и локальным HTTP stub Grid. Проверить exit 1, stderr с точным file:line:column и snippet, отсутствие POST /session и marker-файлов из всех test/hook bodies.
- Marker ставить первой строкой каждого тела, до ошибочной команды; иметь корректный первый файл и ошибочный последний — ни один не должен исполниться.
- Проверить run(TestCollection) через реальный Testplane + stub browser execution; не подменять validateTestCollection. После исправления файла повторить run новым runner и убедиться, что барьер не блокирует.
- Node/browser testRunEnv проверять в unit/integration с stub Vite lifecycle, без необходимости запускать настоящий браузер.
- Выполнить npm pack в временный каталог; установить tarball в временный consumer с --omit=dev --ignore-scripts, сохранив платформенные optional dependencies. Не использовать --omit=optional: он удаляет native binary esbuild и ломает существующую транспиляцию до preflight. Существующие pkg.pr.new зависимости сохранить. Если тестовая среда не может скачать их, зафиксировать packaging smoke как заблокированный сетью, не заменять пакеты и не объявлять smoke успешным.
- В consumer без собственных dev/peer dependencies запустить failing JS/TS fixture с TS_NODE_SWC=false и проверить preflight через существующий esbuild fallback. Проверить packed package.json и npm ls --omit=dev: TypeScript compiler должен быть прямой production dependency Testplane. Не полагаться на hoisting из checkout, очищать NODE_PATH для child process.
- В integration-сценариях удалить все созданные временные файлы/серверы/процессы через finally.
- Измерить parser overhead на 100 и 1000 уникальных небольших файлов, один и несколько browsers: зафиксировать median пяти запусков, peak RSS, число selected-file analyses. При нескольких browsers число анализов должно оставаться равным числу уникальных выбранных файлов; compiler reads зависимостей не входят в этот счётчик. Результаты приложить к PR, без аппаратно-зависимого flaky time assertion.

**Файлы:**

- `test/integration/await-check/await-check.test.ts`.
- `test/fixtures/await-check/integration/*.fixture` — шаблоны для материализации во временный consumer.
- `scripts/test-await-check-package.js` — явный отдельный packaging smoke, не обычный unit suite.
- `scripts/benchmark-await-check.js` — измерение validateTestCollection из build на временных коллекциях; запуск каждого размера в отдельном процессе, median пяти запусков и peak RSS, без браузеров.

**Примеры и документация:**

- `test/integration/profiler/profiler.test.ts` — временные каталоги и реальный Testplane.
- `test/e2e/repl/` — дочерние процессы CLI.
- package.json scripts build/test-integration/prepack.

**Проверка:**

- `npm run build`.
- `TS_NODE_TRANSPILE_ONLY=1 node scripts/run-node-without-type-stripping.js ./node_modules/mocha/bin/mocha.js -r ts-node/register test/integration/await-check/await-check.test.ts`.
- `node scripts/test-await-check-package.js`.
- `node scripts/benchmark-await-check.js`.
- `USE_LOCAL_BROWSER=1 npm run test-integration` — поддержанный локальный backend, если remote Grid :4444 недоступен; screenshot mismatch сравнить с исходным коммитом.

### Этап 8: Документировать границы и выполнить итоговую проверку

**Что добавить/реализовать:**

- Документировать включённую по умолчанию system.checkMissingAwait и отключение; пример исходной ошибки и её исправления через await/return.
- Прямо описать file-level фильтрацию по активным test.file, более раннюю инициализацию workers/серверов, неподдерживаемые UI/синтаксис и программно созданные источники. Inline-hooks в выбранном файле покрыты; отдельные hook-only файлы и внешние/injected hook-функции не покрыты, поскольку Hook не хранит достоверное происхождение.
- Перечислить пропуски: внутренние ошибки внешних helpers, нетипизированные внешние custom commands, any, межфайловой data-flow/escape в неизвестный consumer, сложные изменяемые контейнеры и замыкания, callback-функции по ссылке и DSL wrappers, предварительно транспилированные async state machines, динамические тесты после барьера. Не называть успешный preflight доказательством корректности всех ожиданий.
- Объяснить, почему catch и void не заменяют ожидания в тесте, и почему await Promise.race/any не доказывает завершение всех входных операций.
- Рекомендовать optional typed ESLint как дополнительный слой; примеры конфигурации привязать к версии линтера, не копировать недоступный в 6.12.0 projectService/checkThenables.
- Обновить programmatic API: rejection с diagnostics, isFailed=true уже в END/RUNNER_END; discovery-only readTests. Документировать, что при preflight failure RUNNER_START не вызывается, но RUNNER_END выполняется для cleanup.
- В release notes отметить default-on поведение и необходимость исправить выявленные ошибки/отключить проверку для неподдерживаемого проекта.
- Выполнить проверки на Node 22 и 24; отметить все внешние ограничения прогонов, не записывать неисполненный тест как passed.

**Файлы:**

- `docs/writing-tests.md` — раздел о пропущенных await.
- `docs/typescript.md` — optional linting и его ограничения.
- `docs/programmatic-api.md` — preflight errors.
- `docs/events/runner-end.md` — завершение preflight failure без RUNNER_START и наблюдаемое isFailed().
- `CHANGELOG.md` — запись об изменении поведения; Releases.md описывает график релизов, не changelog.

**Документация:**

- Исследование и официальные TypeScript Compiler API/typescript-eslint ссылки из него.
- `CONTRIBUTING.md`, package.json — локальные проверки.

**Проверка:**

- `npm run build`.
- `npm test` — unit + types + lint.
- `USE_LOCAL_BROWSER=1 npm run test-integration` — поддержанный локальный backend, если remote Grid :4444 недоступен; screenshot mismatch сравнить с исходным коммитом.
- `node scripts/test-await-check-package.js`.
- `git diff --check`.
- Проверить вручную сообщение исходного JS/TS примера, все diagnostics, exit 1 и нулевое число браузерных сессий.
- Заполнить tracker только фактически завершёнными этапами; реализация согласована пользователем; публикация пакета/PR не входит в этот запрос.
