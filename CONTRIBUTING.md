# Contributing Guide for @salesforce/plugin-agentforce-byoc

This page lists the operational governance model of this project, as well as the
recommendations and requirements for how to best contribute to
`@salesforce/plugin-agentforce-byoc`. We strive to obey these as best as
possible. As always, thanks for contributing – we hope these guidelines make it
easier and shed some light on our approach and processes.

# Governance Model

## Salesforce Sponsored

The intent and goal of open sourcing this project is to increase the contributor
and user base. However, only Salesforce employees will be given `admin` rights
and will be the final arbiters of what contributions are accepted or not.

# Getting started

Please review the [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

To build and test the plugin locally:

```bash
# Install dependencies
yarn install

# Compile TypeScript and generate the oclif manifest
yarn build

# Run the unit tests
yarn test

# Lint
yarn lint
```

Run a command from your local build with `./bin/dev.js agentforce-byoc <command>`.

# Issues, requests & ideas

Use the GitHub [Issues](https://github.com/salesforcecli/plugin-agentforce-byoc/issues)
page to submit issues, enhancement requests, and discuss ideas.

### Bug Reports and Fixes

- If you find a bug, please search for it in the
  [Issues](https://github.com/salesforcecli/plugin-agentforce-byoc/issues), and
  if it isn't already tracked,
  [create a new issue](https://github.com/salesforcecli/plugin-agentforce-byoc/issues/new).
  Fill out the "Bug Report" section of the issue template. Even if an Issue is
  closed, feel free to comment and add details, it will still be reviewed.
- Issues that have already been identified as a bug (note: able to reproduce)
  will be labelled `bug`.
- If you'd like to submit a fix for a bug, [send a Pull Request](#creating-a-pull-request)
  and mention the Issue number.
  - Include tests that isolate the bug and verify that it was fixed.

### New Features

- If you'd like to add new functionality to this project, describe the problem
  you want to solve in a
  [new Issue](https://github.com/salesforcecli/plugin-agentforce-byoc/issues/new).
- Issues that have been identified as a feature request will be labelled
  `enhancement`.
- If you'd like to implement the new feature, please wait for feedback from the
  project maintainers before spending too much time writing the code. In some
  cases, `enhancement`s may not align well with the project objectives at the
  time.

### Tests, Documentation, Miscellaneous

- If you'd like to improve the tests, you want to make the documentation clearer,
  you have an alternative implementation of something that may have advantages
  over the way it's currently done, or you have any other change, we would be
  happy to hear about it!
  - If it's a trivial change, go ahead and [send a Pull Request](#creating-a-pull-request)
    with the changes you have in mind.
  - If not, [open an Issue](https://github.com/salesforcecli/plugin-agentforce-byoc/issues/new)
    to discuss the idea first.

# Contribution Checklist

- [x] Clean, well-structured, and self-documented code.
- [x] Passing tests (`yarn test`) and clean lint (`yarn lint`).
- [x] Every source file carries the Apache-2.0 license header.
- [x] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

# Creating a Pull Request

1. **Ensure the bug/feature was not already reported** by searching on GitHub
   under Issues. If none exists, create a new issue so that other contributors
   can keep track of what you are trying to add/fix and offer suggestions (or
   let you know if there is already an effort in progress).
2. **Clone** the forked repo to your machine.
3. **Create** a new branch to contain your work (e.g. `git checkout -b my-fix`).
4. **Commit** changes to your own branch.
5. **Push** your work back up to your fork.
6. **Submit** a Pull Request against the `main` branch and refer to the issue(s)
   you are fixing. Try not to pollute your pull request with unintended changes.
   Keep it simple and small.
7. **Sign** the Salesforce Contributor License Agreement (CLA). When you open
   your first Pull Request, a bot will ask you to sign the CLA if you haven't
   already; contributions cannot be merged until it is signed.

> **NOTE**: Be sure to [sync your fork](https://help.github.com/articles/syncing-a-fork/)
> before making a pull request.

# Code of Conduct

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md).

# License

By contributing your code, you agree to license your contribution under the
terms of our project [LICENSE](LICENSE.txt) and to sign the
[Salesforce CLA](https://cla.salesforce.com/sign-cla).
