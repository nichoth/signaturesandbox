# Signature Sandbox

[![Netlify Status](https://api.netlify.com/api/v1/badges/8c0fa564-8d54-404e-96e1-635ccc11e734/deploy-status)](https://app.netlify.com/projects/signaturesandbox/deploys)
[![tests](https://img.shields.io/github/actions/workflow/status/nichoth/signaturesandbox/playwright.yml?style=flat-square)](https://github.com/nichoth/signaturesandbox/actions/workflows/playwright.yml)


A playground for signatures and things.

## Develop

Start a localhost server.

```sh
npm start
```


## Test

Run some tests locally. This uses [`@axe-core/playwright`](https://www.npmjs.com/package/@axe-core/playwright)
and playwright for tests.

Plus, [see the test report](https://nichoth.github.io/signaturesandbox/).

### Test Screenshots & Accessibility

```sh
npm test
```

### Create New Screenshots

If you changed the visual design of the page, this will generate new
screenshots before running the tests.

```sh
npm run test:e2e:update
```

