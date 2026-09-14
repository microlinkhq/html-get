'use strict'

const { default: listen } = require('async-listen')
const { createServer } = require('net')

const { runServer, test } = require('./helpers')
const getHTML = require('..')

const runResettingServer = async t => {
  const server = createServer(socket => {
    server.connections += 1
    socket.destroy()
  })
  server.connections = 0
  const url = await listen(server)
  t.teardown(() => server.close())
  return { url: url.toString().replace('tcp://', 'http://'), server }
}

const runStatusServer = async (t, statusCode) => {
  const hits = { count: 0 }
  const url = await runServer(t, (_, res) => {
    hits.count += 1
    res.statusCode = statusCode
    res.end()
  })
  return { url, hits }
}

const failingBrowserless = () => ({
  evaluate: () => async () => {
    throw new Error('prerender failed')
  }
})

test('fetch does not retry a network error by default', async t => {
  const { url, server } = await runResettingServer(t)

  const { statusCode, stats } = await getHTML(url, { prerender: false })

  t.is(server.connections, 1)
  t.is(statusCode, undefined)
  t.is(stats.mode, 'fetch')
})

test('prerender fallback fetch does not retry a network error by default', async t => {
  const { url, server } = await runResettingServer(t)

  const { statusCode, stats } = await getHTML(url, {
    prerender: true,
    getBrowserless: failingBrowserless
  })

  t.is(server.connections, 1)
  t.is(statusCode, undefined)
  t.is(stats.mode, 'prerender')
})

test('fetch does not retry a retryable status code by default', async t => {
  const { url, hits } = await runStatusServer(t, 503)

  const { statusCode } = await getHTML(url.toString(), { prerender: false })

  t.is(hits.count, 1)
  t.is(statusCode, 503)
})

test('`gotOpts.retry` still enables retries', async t => {
  const { url, hits } = await runStatusServer(t, 503)

  const { statusCode } = await getHTML(url.toString(), {
    prerender: false,
    gotOpts: {
      retry: { limit: 1, calculateDelay: ({ computedValue }) => (computedValue ? 1 : 0) }
    }
  })

  t.is(hits.count, 2)
  t.is(statusCode, 503)
})
