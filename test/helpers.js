'use strict'

const { default: listen } = require('async-listen')
const browserless = require('@browserless/test')
const dateRegex = require('regex-iso-date')
const { createServer } = require('http')
const test = require('ava').default
const pretty = require('pretty')
const path = require('path')
const fs = require('fs')

let browserUsed = false

test.after.always(() => {
  if (browserUsed) return browserless.getBrowser().close()
})

const getBrowserContext = (...args) => {
  browserUsed = true
  return browserless.getBrowserContext(...args)
}

const createHeaders = name => contentType => ({
  [name]: contentType
})

const closeServer = server =>
  require('util').promisify(server.close.bind(server))()

const fixture = name =>
  fs.readFileSync(path.join(__dirname, '/fixtures/', name))

const runServer = async (t, fn) => {
  const server = createServer(fn)
  const url = await listen(server)
  t.teardown(() => closeServer(server))
  return url
}

const runFixtureServer = async (t, fixturePath) =>
  runServer(t, (_, res) => {
    res.setHeader('content-type', 'text/html')
    res.end(fixture(fixturePath))
  })

const prettyHtml = html =>
  pretty(html, { ocd: true }).replace(dateRegex(), '{DATE}')

module.exports = {
  createHeaders,
  getBrowserContext,
  prettyHtml,
  runFixtureServer,
  runServer,
  test
}
