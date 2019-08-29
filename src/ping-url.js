'use strict'

const reachableUrl = require('reachable-url')
const pReflect = require('p-reflect')
const mem = require('mem')

// Puppeteer doesn't resolve redirection well.
// We need to ensure we have the right url.
const getUrl = async (targetUrl, opts) =>
  pReflect(reachableUrl(targetUrl, opts))

module.exports = mem(getUrl)
