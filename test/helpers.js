'use strict'

const { default: listen } = require('async-listen')
const dateRegex = require('regex-iso-date')
const { createServer } = require('http')
const pretty = require('pretty')
const path = require('path')
const fs = require('fs')

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
  prettyHtml,
  runFixtureServer,
  runServer
}
