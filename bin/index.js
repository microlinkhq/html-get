#!/usr/bin/env node

'use strict'

const { URL } = require('url')
const getHTML = require('..')

const url = new URL(process.argv[2]).toString()
const isDebug = !!process.argv[3]

getHTML(url)
  .then(({ html, stats, headers, statusCode }) => {
    if (isDebug) {
      console.log(`
       url: ${url}
      html: ${Buffer.from(html).byteLength} bytes (HTTP ${statusCode})
      time: ${stats.timing} (${stats.mode})
   headers: ${Object.keys(headers).reduce(
     (acc, key) => `${acc}${key}=${headers[key]} `,
     ''
   )}
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
