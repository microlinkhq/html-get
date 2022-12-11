#!/usr/bin/env node

'use strict'

const createBrowserless = require('browserless')
const mri = require('mri')
const { URL } = require('url')

const getHTML = require('..')

const browserlessFactory = createBrowserless()

const { _: input, debug: isDebug, ...args } = mri(process.argv.slice(2))
const url = new URL(input).toString()

const browserContext = browserlessFactory.createContext()
const getBrowserless = () => browserContext

getHTML(url, { getBrowserless, ...args })
  .then(async ({ html, stats, headers, statusCode }) => {
    if (isDebug) {
      console.log(`
       url: ${url}
      html: ${Buffer.from(html).byteLength} bytes (HTTP ${statusCode})
      time: ${stats.timing} (${stats.mode})
   headers: ${
     headers
       ? Object.keys(headers).reduce(
           (acc, key) => `${acc}${key}=${headers[key]} `,
           ''
         )
       : '-'
   }
`)
    } else {
      console.log(html)
    }
    process.exit(0)
  })
  .catch(async err => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await getBrowserless(browser => browser.destroyContext())
    browserlessFactory.close()
  })
