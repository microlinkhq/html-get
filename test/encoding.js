'use strict'
'use strict'

const { default: listen } = require('async-listen')
const { createServer } = require('http')
const { promisify } = require('util')
const test = require('ava')

const { fixture, initBrowserless } = require('./util')
const getHTML = require('..')

const closeServer = server => promisify(server.close)

const runFixtureServer = async (t, fixturePath) => {
  const server = createServer((_, res) => {
    res.setHeader('content-type', 'text/html')
    res.end(fixture(fixturePath))
  })
  const url = await listen(server)
  t.teardown(() => closeServer(server))
  return url
}

const getBrowserless = initBrowserless(test)

;[false, true].forEach(prerender => {
  const mode = prerender ? 'prerender' : 'fetch'

  test(`${mode} » Shift-JIS`, async t => {
    const url = await runFixtureServer(t, '51242_54045.html')
    const { html } = await getHTML(url, { prerender, getBrowserless })
    t.true(html.includes('或る日の小せん'))
  })

  test(`${mode} » Windows-1250`, async t => {
    const url = await runFixtureServer(t, 'rp.pl.html')
    const { html } = await getHTML(url, { prerender, getBrowserless })
    t.true(html.includes('majątków'))
  })

  test(`${mode} » UTF-8`, async t => {
    const url = await runFixtureServer(t, 'utf8.with.meta.html')
    const { html } = await getHTML(url, { prerender, getBrowserless })
    t.true(html.includes('日本語'))
  })
})
