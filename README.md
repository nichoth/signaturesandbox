# Signature Sandbox

[![Netlify Status](https://api.netlify.com/api/v1/badges/8c0fa564-8d54-404e-96e1-635ccc11e734/deploy-status)](https://app.netlify.com/projects/signaturesandbox/deploys)
[![tests](https://img.shields.io/github/actions/workflow/status/nichoth/signature-sandbox/nodejs.yml?style=flat-square)](https://github.com/nichoth/signature-sandbox/actions/workflows/playwright.yml)


A playground for signatures and things.

## test

Run some tests locally. This uses `@axe-core/playwright` and playwright
for tests.

### Test Screenshots & a11y

```sh
npm test
```

### Create New Screenshots

If you changed the visual design of the page, this will generate new
screenshots before running the tests.

```sh
npm run test:e2e:update
```


## develop

```
npm start
```
