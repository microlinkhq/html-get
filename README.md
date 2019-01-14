# html-get

![Last version](https://img.shields.io/github/tag/Kikobeats/html-get.svg?style=flat-square)
[![Build Status](https://img.shields.io/travis/Kikobeats/html-get/master.svg?style=flat-square)](https://travis-ci.org/Kikobeats/html-get)
[![Coverage Status](https://img.shields.io/coveralls/Kikobeats/html-get.svg?style=flat-square)](https://coveralls.io/github/Kikobeats/html-get)
[![Dependency status](https://img.shields.io/david/Kikobeats/html-get.svg?style=flat-square)](https://david-dm.org/Kikobeats/html-get)
[![Dev Dependencies Status](https://img.shields.io/david/dev/Kikobeats/html-get.svg?style=flat-square)](https://david-dm.org/Kikobeats/html-get#info=devDependencies)
[![NPM Status](https://img.shields.io/npm/dm/html-get.svg?style=flat-square)](https://www.npmjs.org/package/html-get)
[![Donate](https://img.shields.io/badge/donate-paypal-blue.svg?style=flat-square)](https://paypal.me/Kikobeats)

> Get the HTML from any website, using prerendering when is necessary.

## Features

- Get HTML markup from any website (client side apps as well).
- Prerendering detection based on domains whitelist.
- Speed up process blocking ads trackers.
- Encoding body response properly.

<br>

Headless technology like [puppeteer](https://github.com/GoogleChrome/puppeteer) brings us to get the HTML markup from any website, even when the target URL is client side app and we need to wait until dom events fire for getting the real markup.

Generally this approach better than a simple GET request from the target URL, but because you need to wait for dom events, prerendering could be slow and in some scenario unnecessary (sites that use server side rendering could be resolved with a simple GET).

**html-get** bring the best of both worlds, doing the following algorithm:

- Determinate if the target URL actually needs prerendering (internally it has a [whitelisted of popular site domains](https://github.com/Kikobeats/html-get/blob/master/src/auto-domains.js) that don't need it).
- If it needs prerendering, perform the action using Headless technology, blocking ads trackers requests for speed up the process, trying to resolve the main request in the minimum amount of time.
- If it does not need prerendering or prerendering fails for any reason (for example, timeout), the request will be resolved doing a GET request.


## Install

```bash
$ npm install puppeteer html-get --save
```

## Usage

```js
'use strict'

const getHTML = require('html-get')
;(async () => {
  const { url, html, stats } = await getHTML('https://kikobeats.com')
  console.log(url, stats, html.length)
})()
```

## API

### getHTML(url, [options])

#### url

*Required*<br>
Type: `string`

The target URL for getting the HTML markup.

#### options

##### prerender

Type: `boolean|string`<br>
Default: `'auto'`

Enable or disable prerendering as mechanism for getting the HTML markup explicitly.

The value `auto` means that that internally use a list of whitelist website that don't need to use prerendering by default. This list is used for speedup the process, using `fetch` mode for these websites.

See [getMode parameter](#getMode) for know more.

##### getBrowserless

Type: `function`<br>

A function that should return a [browserless](https://browserless.js.org/) instance to be used for interact with puppeteer.

If you don't provide a value, then the library try to load [`@browserless/pool`](https://www.npmjs.com/package/@browserless/pool) or [`browserless`](https://www.npmjs.com/package/browserless) from your dependencies.

##### encoding

Type: `string`<br>
Default: `'utf-8'`

Encoding the HTML markup properly from the body response.

It determines the encode to use A Node.js library for converting HTML documents of arbitrary encoding into a target encoding (utf8, utf16, etc).

##### getMode

Type: `function`<br>

A function evaluation that will be invoked to determinate the resolutive `mode` for getting the HTML markup from the target URL.

The default `getMode` is:

```js
const getMode = (url, { prerender }) => {
  if (prerender === false) return 'fetch'
  if (prerender !== 'auto') return 'prerender'
  return autoDomains.includes(getDomain(url)) ? 'fetch' : 'prerender'
}
```

##### gotOptions

Type: `object`<br>

Under `mode=fetch`, pass configuration object to [got](https://www.npmjs.com/package/got).

##### puppeteerOpts

Type: `object`

Under non `mode=fetch`, pass configuration object to [puppeteer](https://www.npmjs.com/package/puppeteer).

## License

**html-get** © [Kiko Beats](https://kikobeats.com), released under the [MIT](https://github.com/Kikobeats/html-get/blob/master/LICENSE.md) License.<br>
Authored and maintained by Kiko Beats with help from [contributors](https://github.com/Kikobeats/html-get/contributors).

> [kikobeats.com](https://kikobeats.com) · GitHub [Kiko Beats](https://github.com/Kikobeats) · Twitter [@Kikobeats](https://twitter.com/Kikobeats)
