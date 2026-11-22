'use strict'

const path = require('path')
const fs = require('fs')
const os = require('os')

const { runServer, test } = require('./helpers')
const getHTML = require('..')

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const SAMPLE_XLSX = path.join(__dirname, 'fixtures', 'office', 'sample.xlsx')
const SAMPLE_PDF = path.join(os.tmpdir(), 'html-get-convert-limits.pdf')
const FETCH_TIMEOUT = 5000
const SERVER_DELAY = 300

const pandoc = getHTML.defaultPandoc()
const mutool = getHTML.defaultMutool()
const withPandoc = pandoc ? test : test.skip
const withMutool = mutool ? test : test.skip

const serve = (t, contentType, body, delay = 0) =>
  runServer(t, (_, res) =>
    setTimeout(() => {
      res.setHeader('content-type', contentType)
      res.setHeader('content-length', String(body.length))
      res.end(body)
    }, delay)
  )

const serveXlsx = async (t, delay) =>
  `${await serve(t, XLSX, fs.readFileSync(SAMPLE_XLSX), delay)}sheet.xlsx`

const servePdf = async t =>
  String(await serve(t, 'application/pdf', Buffer.from('%PDF-1.4 convert-limits-fixture')))

test.before(() => fs.writeFileSync(SAMPLE_PDF, '%PDF-1.4 convert-limits-fixture'))

const openSignal = () => new AbortController().signal

const abortedSignal = () => {
  const controller = new AbortController()
  controller.abort()
  return controller.signal
}

withPandoc('pandoc is killed when its timeout passes', async t => {
  const error = await t.throwsAsync(
    pandoc('xlsx', SAMPLE_XLSX, { signal: openSignal(), timeout: 1 })
  )
  t.is(error.signalCode, 'SIGKILL')
})

withPandoc('pandoc is killed when its signal aborts', async t => {
  const error = await t.throwsAsync(
    pandoc('xlsx', SAMPLE_XLSX, { signal: abortedSignal(), timeout: FETCH_TIMEOUT })
  )
  t.is(error.name, 'AbortError')
})

const isAlive = pid => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

withPandoc('a running pandoc is killed when its signal aborts', async t => {
  const controller = new AbortController()
  const running = pandoc('html', '-', { signal: controller.signal, timeout: FETCH_TIMEOUT })
  await new Promise(resolve => setTimeout(resolve, 300))
  controller.abort()
  const error = await t.throwsAsync(running)
  t.is(error.name, 'AbortError')
  await new Promise(resolve => setTimeout(resolve, 100))
  t.false(isAlive(error.pid))
})

withMutool('mutool is killed when its signal aborts', async t => {
  const error = await t.throwsAsync(
    mutool(SAMPLE_PDF, { signal: abortedSignal(), timeout: FETCH_TIMEOUT })
  )
  t.is(error.name, 'AbortError')
})

test('pandoc gets an open signal and what is left of the fetch timeout', async t => {
  let received
  await getHTML(await serveXlsx(t, SERVER_DELAY), {
    prerender: false,
    gotOpts: { timeout: FETCH_TIMEOUT },
    pandoc: async (format, filepath, opts) => {
      received = opts
      return '<table></table>'
    }
  })
  t.false(received.signal.aborted)
  t.true(received.timeout > 0)
  t.true(received.timeout <= FETCH_TIMEOUT - SERVER_DELAY)
})

test('mutool gets an open signal and what is left of the fetch timeout', async t => {
  let received
  await getHTML(await servePdf(t), {
    prerender: false,
    gotOpts: { timeout: FETCH_TIMEOUT },
    mutool: async (args, opts) => {
      received = opts
      return { stdout: '<p>converted</p>' }
    }
  })
  t.false(received.signal.aborted)
  t.true(received.timeout > 0)
  t.true(received.timeout <= FETCH_TIMEOUT)
})

test('canceling getHTML aborts a conversion in progress', async t => {
  let converting
  const started = new Promise(resolve => {
    converting = resolve
  })
  const promise = getHTML(await serveXlsx(t), {
    prerender: false,
    pandoc: (format, filepath, { signal }) => {
      converting(signal)
      return new Promise(() => {})
    }
  })
  promise.catch(() => {})
  const signal = await started
  t.false(signal.aborted)
  promise.cancel()
  t.true(signal.aborted)
})

test('a fetch timeout that is not a number leaves the conversion unbounded', async t => {
  let received
  await getHTML(await serveXlsx(t), {
    prerender: false,
    gotOpts: { timeout: { request: FETCH_TIMEOUT } },
    pandoc: async (format, filepath, opts) => {
      received = opts
      return '<table></table>'
    }
  })
  t.is(received.timeout, undefined)
})

test('a fractional fetch timeout still hands an integer timeout to the converter', async t => {
  let received
  await getHTML(await serveXlsx(t), {
    prerender: false,
    gotOpts: { timeout: FETCH_TIMEOUT + 0.5 },
    pandoc: async (format, filepath, opts) => {
      received = opts
      return '<table></table>'
    }
  })
  t.true(Number.isInteger(received.timeout))
})

const encodedAfter = async (t, { cancel }) => {
  let encoded = false
  let converting
  const started = new Promise(resolve => {
    converting = resolve
  })
  const promise = getHTML.getContent(await serveXlsx(t), 'fetch', {
    getTemporalFile: (input, ext) => ({
      path: path.join(os.tmpdir(), `html-get-convert-limits.${ext}`)
    }),
    toEncode: () => {
      encoded = true
      return ''
    },
    pandoc: (format, filepath, { signal }) =>
      new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')))
        converting()
        if (!cancel) reject(new Error('conversion failed'))
      })
  })
  promise.catch(() => {})
  await started
  if (cancel) promise.cancel()
  await new Promise(resolve => setTimeout(resolve, 50))
  return encoded
}

test('a failed conversion falls back to the raw file', async t => {
  t.true(await encodedAfter(t, { cancel: false }))
})

test('a canceled conversion does not fall back to the raw file', async t => {
  t.false(await encodedAfter(t, { cancel: true }))
})
