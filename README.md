<div align="center">
  <img src="https://github.com/microlinkhq/cdn/raw/master/dist/logo/banner.png#gh-light-mode-only" alt="microlink logo">
  <img src="https://github.com/microlinkhq/cdn/raw/master/dist/logo/banner-dark.png#gh-dark-mode-only" alt="microlink logo">
  <br>
  <br>
</div>

![Last version](https://img.shields.io/github/tag/microlinkhq/html-get.svg?style=flat-square)
[![Coverage Status](https://img.shields.io/coveralls/microlinkhq/html-get.svg?style=flat-square)](https://coveralls.io/github/microlinkhq/html-get)
[![NPM Status](https://img.shields.io/npm/dm/html-get.svg?style=flat-square)](https://www.npmjs.org/package/html-get)

> Get the HTML from any website, fine-tuned for correction & speed.

## Features

- Get HTML markup for any URL, including images, video, audio, or pdf.
- Block ads tracker or any non-necessary network subrequest.
- Handle unreachable or timeout URLs gracefully.
- Ensure HTML markup is appropriately encoded.

**html-get** takes advantage of [puppeteer](https://github.com/GoogleChrome/puppeteer) headless technology when is needed, such as client-side apps that needs to be prerender.

## Install

```bash
$ npm install browserless puppeteer@21.X html-get --save
```

supported puppeteer version: ```puppeteer: 21.x```

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

#### options

##### encoding

Type: `string`
Default: `'utf-8'`

It ensures the HTML markup is encoded to the encoded value provided.

The value will be passes to [`html-encode`](https://github.com/kikobeats/html-encode) 

##### getBrowserless

*Required*<br>
Type: `function`

A function that should return a [browserless](https://browserless.js.org/) instance to be used for interact with puppeteer:

##### getMode

Type: `function`

It determines the strategy to use based on the `url`, being the possibles values `'fetch'` or `'prerender'` .

##### getTemporalFile

Type: `function`

It creates a temporal file.

##### gotOpts

Type: `object`

It passes configuration object to [got](https://www.npmjs.com/package/got) under `'fetch'` strategy.

##### headers

Type: `object`

Request headers that will be passed to fetch/prerender process.

##### mutoolPath

Type: `function`

It returns the path for [mutool](https://mupdf.com/) binary, used for turning PDF files into HTML markup.

##### prerender

Type: `boolean`|`string`<br>
Default: `'auto'`

Enable or disable prerendering as mechanism for getting the HTML markup explicitly.

The value `auto` means that that internally use a list of websites that don't need to use prerendering by default. This list is used for speedup the process, using `fetch` mode for these websites.

See [getMode parameter](#getMode) for know more.

##### puppeteerOpts

Type: `object`

It passes coniguration object to [puppeteer](https://www.npmjs.com/package/puppeteer) under `'prerender'` strategy.

##### rewriteUrls

Type: `boolean`<br>
Default: `false`

When is `true`, it will be rewritten CSS/HTML relatives URLs present in the HTML markup into absolutes.

## License

**html-get** © [Microlink](https://microlink.io), released under the [MIT](https://github.com/microlinkhq/html-get/blob/master/LICENSE.md) License.<br>
Authored and maintained by [Kiko Beats](https://kikobeats.com) with help from [contributors](https://github.com/microlinkhq/html-get/contributors).

> [microlink.io](https://microlink.io) · GitHub [microlinkhq](https://github.com/microlinkhq) · Twitter [@microlinkhq](https://twitter.com/microlinkhq)
