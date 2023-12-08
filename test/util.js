'use strict'

const createBrowserless = require('browserless')
const dateRegex = require('regex-iso-date')
const pretty = require('pretty')

const initBrowserless = test => {
  const browserlessFactory = createBrowserless()
  test.after.always(browserlessFactory.close)
  return () => browserlessFactory.createContext()
}

module.exports = {
  prettyHtml: html =>
    pretty(html, { ocd: true }).replace(dateRegex(), '{DATE}'),
  initBrowserless
}
