'use strict'

const createBrowserless = require('browserless')
const dateRegex = require('regex-iso-date')
const onExit = require('signal-exit')
const pretty = require('pretty')

const browserlessFactory = createBrowserless()

onExit(browserlessFactory.close)

const getBrowserless = async () => {
  const browserless = await browserlessFactory.createContext()
  return browserless
}

const result = await getHTML('https://example.com', { getBrowserless })
await browserlessFactory.close()

module.exports = {
  prettyHtml: html =>
    pretty(html, { ocd: true }).replace(dateRegex(), '{DATE}'),
  getBrowserless
}
