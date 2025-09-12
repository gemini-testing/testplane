# Contribution guide

### Legal info

Hello! In order for us (YANDEX LLC) to accept patches and other contributions from you, you will have to adopt our Contributor License Agreement (the “CLA”). The current version of the CLA you may find here:

* https://yandex.ru/legal/cla/?lang=en (in English)
* https://yandex.ru/legal/cla/?lang=ru (in Russian).

By adopting the CLA, you state the following:

* You obviously wish and are willingly licensing your contributions to us for our open source projects under the terms of the CLA,
* You have read the terms and conditions of the CLA and agree with them in full,
* You are legally able to provide and license your contributions as stated,
* We may use your contributions for our open source projects and for any other our project too,
* We rely on your assurances concerning the rights of third parties in relation to your contributions.

If you agree with these principles, please read and adopt our CLA. By providing us your contributions, you hereby declare that you have read and adopted our CLA, and we may freely merge your contributions with our corresponding open source project and use it in further in accordance with terms and conditions of the CLA.

### Provide contributions
If you have adopted terms and conditions of the CLA, you are able to provide your contributions. When you submit your pull request, please add the following information into it:

```
I hereby agree to the terms of the CLA available at: [link].
```

Replace the bracketed text as follows:

* [link] is the link at the current version of the CLA (you may add here a link https://yandex.ru/legal/cla/?lang=en (in English) or a link https://yandex.ru/legal/cla/?lang=ru (in Russian).
It is enough to provide us with such notification once.

### Other questions
If you have any questions, please write us at opensource@yandex-team.ru .

## Pull requests and Code contributions

* Tests must pass.
* Follow our coding style (eslint will help you).
* If you fix a bug, add a test.
* If you can't fix a bug, file an [issue](https://github.com/gemini-testing/testplane/issues) with the steps to reproduce, the expected and the actual results.
* if an issue describes a problem which we are unable to reproduce and issue reporter does not answer our questions for 1 week, then this issue may be closed without further investigation.

## How to develop

### Create your own copy of Testplane repo

**Note.** If you are not a member of gemini-testing and going to submit a PR, you should first create a fork of Testplane repo.

```bash
git clone https://github.com/gemini-testing/testplane.git # Replace with your fork URL
cd testplane
npm install
```

### Create a test project

When working with testplane, you'd want to test your changes on a real project as if you were a user.

To create a test project, use our CLI wizard:

```
npm init testplane@latest testplane-test-project
```

This will create a project in `testplane-test-project` directory.

### Link your local Testplane repo to your test project

Go to Testplane repo directory and run:

```shell
cd testplane
npm link
```

Then go to your test project's directory and run:

```shell
cd testplane-test-project
npm link testplane
```

### Build testplane

To build testplane, you may use `npm run build` command or `npm run watch` to watch for changes.

Great! Now you have everything set up. You can now make some tweaks in testplane and run `npx testplane` in your test project to see how it works with your changes!

### Run checks locally

You may run all linters and tests locally using the command below.

```shell
npm test
```

For a more granular checks, see scripts section in `package.json`.
