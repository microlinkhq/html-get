<div align="center">
  <img src="https://cdn.microlink.io/logo/banner.png" alt="microlink cdn">
  <br>
  <br>
</div>

![Last version](https://img.shields.io/github/tag/microlinkhq/html-get.svg?style=flat-square)
[![Coverage Status](https://img.shields.io/coveralls/microlinkhq/html-get.svg?style=flat-square)](https://coveralls.io/github/microlinkhq/html-get)
[![NPM Status](https://img.shields.io/npm/dm/html-get.svg?style=flat-square)](https://www.npmjs.org/package/html-get)

> Get the HTML from any website, using prerendering when is necessary.

## Features

- Get HTML markup from any website (client side apps as well).
- Prerendering detection based on domains list.
- Speed up process blocking ads trackers.
- Encoding body response properly.

<br>

Headless technology like [puppeteer](https://github.com/GoogleChrome/puppeteer) brings us to get the HTML markup from any website, even when the target URL is client side app and we need to wait until dom events fire for getting the real markup.

Generally this approach better than a simple GET request from the target URL, but because you need to wait for dom events, prerendering could be slow and in some scenario unnecessary (sites that use server side rendering could be resolved with a simple GET).

**html-get** bring the best of both worlds, doing the following algorithm:

- Determinate if the target URL actually needs prerendering (internally it has a [list of popular site domains](https://github.com/microlinkhq/html-get/blob/master/src/auto-domains.js) that don't need it).
- If it needs prerendering, perform the action using Headless technology, blocking ads trackers requests for speed up the process, trying to resolve the main request in the minimum amount of time.
- If it does not need prerendering or prerendering fails for any reason (for example, timeout), the request will be resolved doing a GET request.

## Install

```bash
$ npm install puppeteer html-get --save
```

## Usage

```js
const createBrowserless = require('browserless')
const getHTML = require('html-get')

// Spawn Chromium process once
const browserlessFactory = createBrowserless()

// Kill the process when Node.js exit
process.on('exit', () => {
  console.log('closing resources!')
  browserlessFactory.close()
})

const getContent = async url => {
  // create a browser context inside Chromium process
  const browserContext = browserlessFactory.createContext()
  const getBrowserless = () => browserContext
  const result = await getHTML(url, { getBrowserless })
  // close the browser context after it's used
  await getBrowserless((browser) => browser.destroyContext())
  return result
}

getContent('https://example.com')
  .then(content => {
    console.log(content)
    process.exit()
  })
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
```

### Command Line

```
$ npx html-get https://example.com
```

## API

### getHTML(url, [options])

#### url

*Required*<br>
Type: `string`

The target URL for getting the HTML markup.

##### getBrowserless

*Required*<br>
Type: `function`<br>

A function that should return a [browserless](https://browserless.js.org/) instance to be used for interact with puppeteer:

#### options

##### prerender

Type: `boolean`|`string`<br>
Default: `'auto'`

Enable or disable prerendering as mechanism for getting the HTML markup explicitly.

The value `auto` means that that internally use a list of websites that don't need to use prerendering by default. This list is used for speedup the process, using `fetch` mode for these websites.

See [getMode parameter](#getMode) for know more.

##### encoding

Type: `string`<br>
Default: `'utf-8'`

Encoding the HTML markup properly from the body response.

It determines the encode to use A Node.js library for converting HTML documents of arbitrary encoding into a target encoding (utf8, utf16, etc).

##### headers

Type: `object`<br>

Request headers that will be passed to fetch/prerender process.

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

##### rewriteUrls

Type: `boolean`<br>
Default: `false`

When is `true`, it will be rewritten CSS/HTML relatives URLs present in the HTML markup into absolutes.

## License

**html-get** © [Microlink](https://microlink.io), released under the [MIT](https://github.com/microlinkhq/html-get/blob/master/LICENSE.md) License.<br>
Authored and maintained by [Kiko Beats](https://kikobeats.com) with help from [contributors](https://github.com/microlinkhq/html-get/contributors).

> [microlink.io](https://microlink.io) · GitHub [microlinkhq](https://github.com/microlinkhq) · Twitter [@microlinkhq](https://twitter.com/microlinkhq)
