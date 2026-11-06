# Предварительная проверка пропущенного await: исследование и проект решения

Дата: 2026-11-06.
База исследования: `9eb4201b967ca16f6baf8c138169886bb0ed24e6`, Testplane 9.3.6.
Worktree: `/Users/sipayrt/.codex/worktrees/missing-await-preflight/testplane`.
Ветка: `sp.missing-await-preflight`.
Статус: вариант AST и расширение проверки согласованы пользователем 2026-11-06.

## Согласованное расширение

Ниже зафиксирован согласованный расширенный контракт. Добавлены локальный анализ сохранённых промисов и aliases, обычные ветвления, массивы промисов и async callbacks стандартных массивов. TypeChecker расширяет распознавание импортированных helpers/custom commands по PromiseLike-returning типам. Реализации импортированных helpers и динамические регистрации не исполняются и не анализируются рекурсивно.

Для общей модели AST + types используется TypeScript Compiler API 5.3.2 (существующая версия проекта), а не Babel AST с отдельным вторым деревом TypeScript. TS становится runtime dependency; пользовательский ESLint/tsconfig не обязателен. Читается ближайший tsconfig для module resolution, при отсутствии используются встроенные defaults. Неполные/any-типы не отключают распознавание известных команд. Ограничения полной точности сохраняются для escape в неизвестный consumer, сложных изменяемых контейнеров/замыканий и динамики.


## Требование

До выполнения первого теста остановить запуск, если статически обнаружен потерянный промис команды, например `browser.assertView("plane")`. Показать все найденные места: файл, строку, колонку, фрагмент исходника и способ исправления. Проверка должна работать из коробки в JS и TS, без пользовательского tsconfig и ESLint. Это ограничение пользователь подтвердил отдельно.

Рекомендация автора: встроенная консервативная AST-проверка начальной коллекции. Она выявляет определённый класс ошибок, а не доказывает отсутствие всех пропущенных ожиданий в произвольном JavaScript.

## Что работает сейчас

- `src/worker/runner/test-runner/execution-thread.js`, `_call`: ожидается результат `runnable.fn`. Отдельный промис, который функция не вернула и не ожидала, в это ожидание не входит.
- `src/browser/stacktrace/index.ts`: команды оборачиваются для сохранения пользовательского стека. Это runtime-механизм, а не статический анализ.
- `src/worker/runner/test-runner/index.js`: уже полученная ошибка обогащается `extendWithCodeSnippet`.
- `src/errors/unhandled-rejection-error.ts`: сообщение об unhandled rejection уже рекомендует `@typescript-eslint/no-floating-promises`. Разрешившийся потерянный промис такой ошибки может вообще не дать.
- `src/error-snippets/utils.ts:51`: `formatErrorSnippet(error, {file, source, location})` уже принимает готовые координаты. Его можно использовать напрямую, не создавая фиктивный runtime-стек.
- `src/test-reader/index.ts`: SetsBuilder выбирает файлы; TestParser загружает определения тестов; затем применяются фильтры. Тела тестов и beforeEach/afterEach при сборе коллекции не выполняются.
- `src/testplane.ts:246-276`: сначала серверы, INIT, workers и beforeAll, затем чтение тестов, затем `runner.run`. `src/utils/workers-registry.js` действительно использует `autoStart: true`.
- `src/runner/index.ts:115-126`: общая точка перед RUNNER_START, BEGIN и постановкой тестов в BrowserRunner; существующий finally завершает workers.
- `Testplane.run(TestCollection)` обходит `TestReader`. Поэтому проверка только в читателе файлов была бы неполной.
- `src/test-reader/test-object/hook.ts:32` возвращает для hook файл родительского suite; `src/test-reader/mocha-reader/tree-builder-decorator.js:55` не переносит mochaHook.file. Это не надёжное происхождение кода hook: отдельно подключённые/root-hook-only файлы нельзя обещать покрыть простым обходом suites.
- `src/utils/typescript.ts` использует SWC/esbuild для транспиляции, без обязательного type-checking. `@babel/parser` сейчас optional peer + devDependency, а не гарантированная runtime-зависимость.
- Список `src/browser/history/commands.ts` нельзя целиком объявить асинхронным: в нём присутствуют `addCommand`, `overwriteCommand` и синхронный builder `action`. Имена файлов custom commands также не всегда равны именам API: `assert-view` → `assertView`, `captureDomSnapshot` → `unstable_captureDomSnapshot`.

## Рассмотренные варианты

| Вариант | Достоинства | Ограничения | Решение |
|---|---|---|---|
| Typed ESLint: no-floating-promises + no-misused-promises | Готовые правила; типизированные helper-функции, thenables, callback-ошибки | Нужны корректные типы и программа TypeScript; any даёт пропуски; семантика catch не равна ожиданию окончания теста | Дополнительный пользовательский слой, не обязательная реализация |
| AST-проверка известных команд Testplane/WDIO | JS/TS без настройки; исходные координаты; не выполняет тесты; ограниченный объём работы | Не решает полный data-flow и межфайловой анализ; нужен каталог и учёт областей видимости | Рекомендуется |
| Dry-run с mock/proxy browser либо усиление runtime-tracking | Видит часть реальных динамических вызовов | Выполняет пользовательский код и побочные эффекты, не покрывает все ветки, не соответствует проверке до выполнения | Отказаться |

Regex и поиск отсутствующего текста `await` не подходят: комментарии, вложенные функции, цепочки, aliases и return дают неверные результаты.

## Проверенные эксперименты

На установленных TypeScript 5.3.2, ESLint 8.25.0 и typescript-eslint 6.12.0 выполнен in-memory анализ без исполнения тестов. Включены no-floating-promises с ignoreVoid:false и no-misused-promises:

| Конструкция | Результат этих правил |
|---|---|
| Типизированный `browser.assertView(...)` | Ошибка |
| Тот же browser с типом any в JS | Пропуск |
| JS с JSDoc-типацией Promise-returning assertView | Ошибка |
| `await` / `return` / `const p = ...; await p` | Допускается |
| `const p = browser.assertView(...)` без дальнейшего использования | Пропуск |
| `Promise.all([browser.assertView(...)])` без await | Ошибка |
| `browser.assertView(...).catch(() => {})` без await | Допускается |
| `void browser.assertView(...)` при ignoreVoid:false | Ошибка |
| `[1,2].forEach(async () => { await ... })` | Ошибка no-misused-promises |
| `[1,2].map(async () => { await ... })` без использования результата | Пропуск в установленной версии |

Это наблюдения о конкретных версиях, не утверждение обо всех версиях линтера. Современная документация содержит дополнительные настройки, которых нет в 6.12.0.

Babel 7.28.5 отдельно проверен на JS, TS, TSX, TS type assertion, CJS top-level return и ESM top-level await: парсинг работает, координаты assertView получены без исполнения. Колонка Babel начинается с 0, колонка code-frame — с 1.

Запущено 298 существующих unit-тестов читателя, парсера, snippets, Testplane и MainRunner: 298 passed, exit 0. В выводе есть текущие сообщения selectivity и завершения worker, без падения тестов. Полная сборка, весь набор тестов и браузерные тесты в рамках исследования не запускались.

## Контракт реализации

### Момент проверки и область файлов

1. Один барьер в начале `MainRunner.run`, внутри существующего try/finally, до RUNNER_START/BEGIN и создания BrowserRunner.
2. Пока проверка идёт, `runned=false`: `addTestToRun` не должен начинать выполнение в обход барьера.
3. Взять уникальные локальные test.file из переданной коллекции для тестов с `!pending && !disabled`. Внутри этих файлов проверять inline beforeEach/afterEach и их TDD-аналоги. Не расширять набор через hook.file: он наследуется от suite и не является достоверным путём к исходнику hook. Отдельные hook-only файлы, импортированные hooks и программно добавленные callbacks за пределами первой версии, даже если discovery загружал такой файл.
4. Анализировать файлы целиком. Фильтры paths/sets/browser/grep/tag/lastFailed определяют, какие файлы попали в коллекцию, но не вырезают тела отдельных тестов из уже выбранного файла. Поэтому ошибка в skipped/неподходящем под grep тесте того же файла тоже блокирует запуск. Это явный file-level контракт первой версии.
5. Missing-await diagnostics собирать только в выбранных файлах. TypeScript Program вправе читать imports, declarations и файлы ближайшего tsconfig для типов, но не исполняет пользовательский код и не обходит импортированные тела для diagnostics. Не использовать fn.toString/eval.
6. Сохраняется обычное исполнение конфигурации, INIT, beforeAll и top-level кода файлов при discovery. Гарантия: до выполнения тестов/hooks и браузерных команд раннером, а НЕ до любого пользовательского кода или старта workers/dev-server.
7. Обычный CLI и `run(TestCollection)` используют один барьер. `readTests/list-tests` остаются операциями discovery без новой проверки.
8. Динамические тесты, добавленные после успешного барьера через `addTestToRun`, и исходники, не представленные активными test.file, не покрываются. Если у активного теста отсутствует локальный file, вернуть явную ошибку недоступности проверки; не выдавать это за успешную проверку. Наличие file у синтетического теста не доказывает, что его программно подменённый fn совпадает с callback в этом файле.
9. При TestPreflightError MainRunner синхронно эмитит MasterEvents.ERROR до перехода к finally. Специальная ветка Testplane._handleError немедленно вызывает _fail(), но не halt: isFailed() уже true для END/RUNNER_END, а workers завершаются обычным finally. Затем Testplane._run вызывает существующий `halt(error, 0, false)` и повторно выбрасывает исходную ошибку: EXIT и закрытие Vite используют текущий аварийный путь, без таймера принудительного выхода и повторного внутреннего логирования. Вторичная ошибка cleanup не заменяет preflight-диагностику. CLI сохраняет exit code 1. Управление внешним dev-server остаётся существующим: CLI завершает его при выходе процесса; новую общую модель владения ресурсами не вводим.

### Синтаксис, области видимости и команды

- Исходники: .js/.jsx/.mjs/.cjs/.ts/.tsx/.mts/.cts; TypeScript Compiler API 5.3.2, без пользовательской Babel-конфигурации. Синтаксис разбирается по расширению, координаты оригинального SourceFile переводятся в 1-based. Ошибки parser/config диагностируются явно.
- Распознавать стандартные bdd/tdd/qunit inline function/arrow callbacks: it/specify/test, beforeEach/afterEach/setup/teardown, .only/.skip; именованные импорты/require из testplane и mocha, включая aliases. Глобальные имена считаются DSL только при отсутствии затеняющего binding. Callback по ссылке (`it(name, externalFn)`), exports/custom UI и произвольные wrappers над DSL не анализируются как стандартный callback.
- Получать browser из параметра контекста callback, destructuring `{browser}`/`{browser: bro}`, `this.browser` в function-callback и лексически вложенных стрелках; поддержать неизменяемые const-aliases этих объектов.
- Не считать любой идентификатор с именем browser браузером. Затенённый параметр, локальный mock-object, обычная вложенная function со своим this — другие bindings.
- Отслеживать элементные receivers от $, custom$, react$, shadow$, parentElement/nextElement/previousElement; массивы от $$ и соответствующих вариантов, индексирование числовым литералом и const-alias после await. Иные переходы receiver → receiver без известного контракта не угадывать.
- Каталог: существующие WDIO browser/element lists с исключением sync API; protocol commands из чистых экспортов @testplane/wdio-protocols; явно именованные Testplane commands из их регистраций/типов. Не создавать сессию и не импортировать реализацию assertView ради каталога.
- `browser.action(...)` — sync builder, его fluent-переходы сохраняют builder; `perform()` — async. `browser.actions(...)` — async.
- Из `addCommand("literal", callback, literalScope)` в анализируемом файле добавлять имя в каталог соответствующего scope. Внешние custom commands распознаются по PromiseLike-returning типам, когда они доступны. Не угадывать неизвестные динамические регистрации/plugin/prepareBrowser.
- Клиентские функции, переданные в execute/executeAsync, не анализировать как код Node.js browser-команд.

### Что считать потерянным ожиданием

Проверять отброшенные выражения с известным async-результатом. Отчёт — один на потерянную promise-цепочку: `$().click()` не дублируется по обоим вызовам, а отброшенный `Promise.all([...])` даёт одну ошибку на агрегате. Указывать начало выражения, перед которым нужно поставить await, а не внутренний аргумент. Независимые ветви conditional/sequence дают отдельные места.

| Конструкция | Решение |
|---|---|
| `browser.assertView(...)`, `this.browser.url(...)`, `browser.$(...).click()` | Ошибка |
| Те же вызовы через доказанный const-alias, строковый computed member или optional chain | Ошибка |
| `await command()`, `return command()`, expression-body arrow `() => command()` | Нет ошибки на этом выражении |
| `await Promise.all([command(), command()])` | Нет ошибки на переданных командах |
| Неожидаемые `Promise.all/allSettled/race/any/resolve` с синтаксически видимой командой | Ошибка на агрегате |
| Неожидаемые `command().then/catch/finally(...)` | Ошибка: обработать rejection недостаточно для lifetime теста |
| `void command()` | Ошибка: void не является ожиданием |
| Отброшенные conditional/logical/sequence-ветви с известной командой | Ошибка для действительно отбрасываемого значения, с учётом границ функций |
| `const p = command(); await p` | Не ошибаться |
| `const p = command()` и забытый p | Ошибка локального data-flow; await/return на всех моделируемых нормальных выходах снимают обязательство |
| Передача промиса в неизвестную функцию, объект или сложный mutable container | Выход за область анализа; не считать доказанно безопасным |
| Локальные массивы промисов / известные Promise-returning helpers | Отслеживать результат; await Promise.all массива снимает обязательство |
| Стандартный Array.forEach(async...) / потерянный Promise[] от map | Ошибка; ожидаемый Promise.all(map(...)) допустим |

Для распространения использования результата применять явный контекст: discarded / awaited / returned / forwarded / unknown. ExpressionStatement начинает discarded; await потребляет только результат своего аргумента; return и implicit-return передают результат текущей функции. Префиксы sequence всегда discarded, последний элемент наследует внешний контекст; обе conditional-ветви наследуют контекст. У logical-выражения правая ветвь наследует контекст, левая используется как условие и не объявляется awaited; общий анализ неправильного использования promise в условиях/арифметике вне первой версии. Пример `await (browser.url('/'), browser.assertView('x'))`: url потерян и должен быть найден, assertView ожидается. Arguments известного Promise-combinator передаются в его результат; arguments неизвестной функции имеют unknown, а не считаются автоматически ожидаемыми. Локальные переменные и aliases сохраняют связь с порождающими промис вызовами.

Await внешней функции не оправдывает потерянный вызов внутри её callback. Например, `await browser.runStep("x", () => { browser.assertView("x"); })` должен дать ошибку на assertView. `return` и implicit return признаются передачей промиса только из самой текущей функции, не доказательством ожидания её вызывающим кодом.

### Ошибки, настройка, производительность

- `system.checkMissingAwait: boolean`, default true. false полностью выключает барьер и загрузку анализатора; существующие способы env/CLI overriding работают через configparser.
- Неизвестный custom mocha UI, exports UI, неизвестное расширение, недоступный файл или синтаксис — явная диагностическая ошибка preflight, а не молчаливый успех. Для неподдерживаемых проектов доступно отключение настройки. Это изменение поведения должно попасть в release notes.
- Общий `TestPreflightError` содержит структурированные diagnostics с кодами missing-await / parse-error / read-error / unsupported-file / unsupported-ui / missing-source.
- У каждой ошибки с координатами: file:line:column и существующий `formatErrorSnippet`. Для CLI всё человекочитаемое содержимое включено в stack: CLI сейчас печатает stack, не snippet.
- Собрать все диагностируемые места до завершения; сортировка file/line/column, без повторов по браузерам. Без автоправки кода, фиктивных TEST_FAIL, retries или превращения ошибки в зелёный запуск.
- Каждый уникальный выбранный файл анализировать один раз за run независимо от browsers. Program/TypeChecker создаются по группам ближайшего tsconfig и живут только в текущем вызове; результаты не сохраняются между запусками. Исходники/AST нужны во время анализа, ошибка удерживает лишь diagnostics и готовый snippet. Измерения selected-file analyses не равны общему числу compiler reads для импортов/типов.
- Для заранее скомпилированных JS-файлов проверяется доступный JS, координаты относятся к нему; восстановление TS по внешним source maps и распознавание транспилированных async state machines не входят в первую версию.
- Не обещать 100% обнаружение. Неанализируемые динамические области перечислены в пользовательской документации; runtime-защита остаётся.

## Документация и источники

- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API): Program, TypeChecker, source files, node traversal.
- [Babel parser](https://babeljs.io/docs/babel-parser): исследованный, но не выбранный вариант parser.
- [no-floating-promises](https://typescript-eslint.io/rules/no-floating-promises/): правило обработки promise, void и thenables; оно не является полным анализом lifetime теста.
- [no-misused-promises](https://typescript-eslint.io/rules/no-misused-promises/): отдельные callback-ошибки.
- [Typed linting](https://typescript-eslint.io/getting-started/typed-linting/): требования к информации о типах.
- Локальные `docs/writing-tests.md`, `docs/typescript.md`, `docs/events/init.md`, `docs/events/runner-start.md` и `docs/programmatic-api.md`.
- Babel-зависимости не меняются; TypeScript 5.3.2 перенесён в прямые production dependencies.

## Приёмка

Неверный assertView в JS без tsconfig и в TS без пользовательского ESLint останавливает всю начальную коллекцию с кодом 1, точными координатами и snippet. Ни один тест, test hook или браузерная сессия не стартует, включая корректные тесты в других файлах коллекции. Корректные await/return/Promise.all проходят. Существующая runtime-диагностика продолжает работать для статически не покрываемых случаев.

## Проверки реализации

- Реальный CLI: JS/TS/TSX без пользовательских ESLint/tsconfig, точные координаты, exit 1, ноль POST /session, marker в начале каждого test/hook body не создан.
- API run(TestCollection): реальный валидатор, nodejs/browser modes, isFailed уже в teardown, повторный запуск после исправления проходит. API smoke изолирован дочерним процессом против build для настоящих workers и отсутствия утечки global registry в соседние standalone tests.
- Чистый tarball consumer: npm install --omit=dev --ignore-scripts с optional dependencies, TS runtime dependency, JS/TS preflight через esbuild fallback, NODE_PATH пуст.
- Node 24.19.0, 5 свежих процессов на вариант, небольшие файлы без tsconfig: 100 файлов / 1 browser — median 145 ms, peak RSS 232080 KiB; 100 / 3 — 147 ms, 231264 KiB; 1000 / 1 — 354 ms, 320944 KiB; 1000 / 3 — 356 ms, 321216 KiB. Peak RSS всего процесса, не добавочный расход. Число selected-file analyses равно 100/1000; большой пользовательский проект/граф imports может стоить больше. Метрики не являются аппаратно-независимым порогом теста.
- Общий integration на локальном Chrome 138: 55 passed, 5 screenshot mismatches. Те же пять tests воспроизведены на неизменённом базовом коммите 9eb4201b в отдельном временном checkout (2 passed, 5 failed в screenshot suite). Штатный remote Grid :4444 в окружении отсутствует; эталоны не перезаписывались.
