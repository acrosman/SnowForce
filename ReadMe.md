# snowForce

![Lint Status](https://github.com/acrosman/snowForce/actions/workflows/lint.yml/badge.svg) ![CodeQL Status](https://github.com/acrosman/snowForce/actions/workflows/codeql-analysis.yml/badge.svg) ![Electronegativity Status](https://github.com/acrosman/snowForce/actions/workflows/electronegativity.yml/badge.svg) ![Test Status](https://github.com/acrosman/snowForce/actions/workflows/tests.yml/badge.svg)

This is a tool to generate [Snowfakery](https://snowfakery.readthedocs.io/en/latest/) recipes based on the structure of a Salesforce org and your guidance. snowForce will connect to a Salesforce org, allow you to select a collection of objects, and guide you to generate a Snowfakery recipe.

For example recipes for Snowfakery see the [Salesforce Commons Snowfakery Recipe Templates](https://github.com/SFDO-Community-Sprints/Snowfakery-Recipe-Templates).

## Getting Started

You can either download the [latest release](https://github.com/acrosman/snowForce/releases/latest) for your operating system or run from code.

There should always be a release for Windows (the exe file is an installer), Mac (the dmg file is a standard disk image), and Linux (the zip file contains the executable and supporting materials). You can also download the source archives if you want to explore the version of the code that went into the release.

To run the project from code you will need a working copy of [NodeJS](https://nodejs.org) 18 or later.

1. Clone this repo (or create your own fork) to your local machine.
1. Run: `npm install` from the project root directory, and wait for all the packages to load (this takes a few minutes).
1. Run: `npm start`

## Salesforce Login

Currently only the username and password login system is supported, not OAuth2, so you likely will need your [security token](https://help.salesforce.com/articleView?id=user_security_token.htm&type=5).

In the login fields provide your username, password, and security token. If you are logging into a production or Trailhead playground you can use the default login URL. If you are logging into a Sandbox use: https://test.salesforce.com.

## Disclaimer

This project has no direct association with Salesforce except the use of the APIs provided under the terms of use of their services.

## Getting Involved

If you would like to contribute to this project please feel invited to do so. Feel free to review open [issues](issues) and read the [contributing guide](contributing.md).
