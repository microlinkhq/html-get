'use strict'

const createBrowserless = require('browserless')
const onExit = require('signal-exit')
const pretty = require('pretty')

const browserlessFactory = createBrowserless()

onExit(browserlessFactory.close)

const getBrowserless = async () => {
  const browserless = await browserlessFactory.createContext()
  return browserless
}

module.exports = {
  prettyHtml: html => pretty(html, { ocd: true }),
  getBrowserless
}
