'use strict'

const test = require('ava')

const { initBrowserless, runServer, prettyHtml } = require('./helpers')
const getHTML = require('..')

const getBrowserless = initBrowserless(test)

;[false, true].forEach(prerender => {
  const mode = prerender ? 'prerender' : 'fetch'
  test(`${mode} » as string`, async t => {
    const url = await runServer(t, (_, res) =>
      res.end('<!doctype html><title>.</title>')
    )
    const { html } = await getHTML(url.toString(), {
      getBrowserless,
      prerender,
      puppeteerOpts: { adblock: false, animations: true }
    })

    t.is(
      prettyHtml(html),
      prettyHtml(`<!DOCTYPE html>
    <html>
      <head>
        <title>.</title>
        <meta name="date" content="{DATE}">
        <link rel="canonical" href="${url.toString()}">
      </head>
      <body></body>
    </html>`)
    )
  })

  test(`${mode} » as WHATWG URL object`, async t => {
    const url = await runServer(t, (_, res) =>
      res.end('<!doctype html><title>.</title>')
    )
    const { html } = await getHTML(url, {
      getBrowserless,
      prerender,
      puppeteerOpts: { adblock: false, animations: true }
    })

    t.is(
      prettyHtml(html),
      prettyHtml(`<!DOCTYPE html>
    <html>
      <head>
        <title>.</title>
        <meta name="date" content="{DATE}">
        <link rel="canonical" href="${url.toString()}">
      </head>
      <body></body>
    </html>`)
    )
  })
})
