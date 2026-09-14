'use strict'

const { createServer } = require('net')
const { once } = require('events')
const http = require('http')
const got = require('got')

const { restoreEndCallback, wrapEnd } = require('../src/got-hooks')
const { test } = require('./helpers')
const getHTML = require('..')

const RETRY_DELAY = 50

const getClosedPortUrl = async () => {
  const server = createServer().listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address()
  server.close()
  await once(server, 'close')
  return `http://127.0.0.1:${port}/`
}

const waitForLeakedRetry = () => new Promise(resolve => setTimeout(resolve, RETRY_DELAY * 2))

const createFakeRequest = endError => ({
  end (onEnd) {
    this.endCalls = (this.endCalls ?? 0) + 1
    if (endError) onEnd(endError)
    else onEnd()
    return this
  }
})

const endWith = endError => {
  const request = wrapEnd(createFakeRequest(endError))
  const calls = []
  const returned = request.end((...args) => calls.push(args))
  return { request, calls, returned }
}

const retryOpts = attempts => ({
  retry: {
    limit: 1,
    calculateDelay: ({ computedValue }) => (computedValue ? RETRY_DELAY : 0)
  },
  hooks: { beforeRetry: [() => attempts.push('retry')] }
})

test('wrapEnd calls back when the request finishes', t => {
  const { request, calls, returned } = endWith()
  t.deepEqual(calls, [[]])
  t.is(request.endCalls, 1)
  t.is(returned, request)
})

test('wrapEnd ignores the error of a request that could not be flushed', t => {
  const error = Object.assign(new Error('closed'), { code: 'ERR_SOCKET_CLOSED_BEFORE_CONNECTION' })
  const { calls } = endWith(error)
  t.deepEqual(calls, [])
})

test('wrapEnd keeps the error of a request that already finished', t => {
  const error = Object.assign(new Error('finished'), { code: 'ERR_STREAM_ALREADY_FINISHED' })
  const { calls } = endWith(error)
  t.deepEqual(calls, [[error]])
})

test('wrapEnd passes through calls without a callback', t => {
  const received = []
  const request = wrapEnd({ end: (...args) => received.push(args) })
  request.end('chunk', 'utf8')
  t.deepEqual(received, [['chunk', 'utf8']])
})

test('restoreEndCallback wraps the request function of the url protocol', t => {
  for (const protocol of ['http:', 'https:']) {
    const options = { url: new URL(`${protocol}//127.0.0.1:1`) }
    restoreEndCallback(options)
    const request = options.request(options.url, {})
    request.on('error', () => {})
    t.true(request instanceof http.ClientRequest)
    t.is(request.protocol, protocol)
    t.not(request.end, http.ClientRequest.prototype.end)
    request.destroy()
  }
})

test('restoreEndCallback keeps a request function set by the user', t => {
  const request = () => {}
  const options = { url: new URL('https://example.com'), request }
  restoreEndCallback(options)
  t.is(options.request, request)
})

test('restoreEndCallback does not wrap http2 requests', t => {
  const options = { url: new URL('https://example.com'), http2: true }
  restoreEndCallback(options)
  t.is(options.request, undefined)
})

test('got retries a network error and rejects with it', async t => {
  const url = await getClosedPortUrl()
  const attempts = []
  const opts = retryOpts(attempts)

  const error = await t.throwsAsync(
    got(url, {
      ...opts,
      hooks: { ...opts.hooks, beforeRequest: [restoreEndCallback] }
    })
  )

  await waitForLeakedRetry()
  t.is(error.code, 'ECONNREFUSED')
  t.deepEqual(attempts, ['retry'])
})

test('fetch keeps retries for network errors without uncaught exceptions', async t => {
  const url = await getClosedPortUrl()
  const attempts = []

  const { statusCode, stats } = await getHTML(url, {
    prerender: false,
    gotOpts: retryOpts(attempts)
  })

  await waitForLeakedRetry()
  t.is(statusCode, undefined)
  t.is(stats.mode, 'fetch')
  t.deepEqual(attempts, ['retry'])
})

test('fetch keeps `beforeRequest` hooks provided by the user', async t => {
  const url = await getClosedPortUrl()
  const seen = []

  await getHTML(url, {
    prerender: false,
    gotOpts: { retry: 0, hooks: { beforeRequest: [options => seen.push(options.url.href)] } }
  })

  t.deepEqual(seen, [url])
})
