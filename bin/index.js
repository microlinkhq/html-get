#!/usr/bin/env node

'use strict'

const minimist = require('minimist')
const { URL } = require('url')

const getHTML = require('..')

const [input, ...argv] = process.argv.slice(2)
const url = new URL(input).toString()

const { debug: isDebug, ...args } = minimist(argv)

getHTML(url, args)
  .then(({ html, stats, headers, statusCode }) => {
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
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
