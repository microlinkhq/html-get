'use strict'

const test = require('ava')

const { runFixtureServer, initBrowserless } = require('./util')
const getHTML = require('..')

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
