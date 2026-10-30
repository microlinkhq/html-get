'use strict'

const { getBrowserContext, runServer, prettyHtml, test } = require('./helpers')
const getHTML = require('..')

;[false, true].forEach(prerender => {
  const mode = prerender ? 'prerender' : 'fetch'
  test(`${mode} » as string`, async t => {
    const url = await runServer(t, (_, res) => res.end('<!doctype html><title>.</title>'))
    const { html } = await getHTML(url.toString(), {
      getBrowserless: () => getBrowserContext(t),
      prerender,
      puppeteerOpts: { adblock: false, animations: true }
    })

    t.is(
      prettyHtml(html),
      prettyHtml(`<!DOCTYPE html>
    <html>
      <head>
        <title>.</title>
        <link rel="canonical" href="${url.toString()}">
      </head>
      <body></body>
    </html>`)
    )
  })

  test(`${mode} » as WHATWG URL object`, async t => {
    const url = await runServer(t, (_, res) => res.end('<!doctype html><title>.</title>'))
    const { html } = await getHTML(url, {
      getBrowserless: () => getBrowserContext(t),
      prerender,
      puppeteerOpts: { adblock: false, animations: true }
    })

    t.is(
      prettyHtml(html),
      prettyHtml(`<!DOCTYPE html>
    <html>
      <head>
        <title>.</title>
        <link rel="canonical" href="${url.toString()}">
      </head>
      <body></body>
    </html>`)
    )
  })

  const runRedirectServer = t =>
    runServer(t, (req, res) => {
      const location = {
        '/one': '/two',
        '/two': '/target',
        '/own': '/target#own',
        '/empty': '/target#',
        '/empty-then-none': '/empty-mid#',
        '/empty-mid': '/target'
      }[req.url]
      if (location) {
        res.statusCode = 302
        res.setHeader('location', location)
        return res.end()
      }
      res.setHeader('content-type', 'text/html')
      res.end('<!doctype html><title>.</title>')
    })

  const getFragmentResult = (t, url) =>
    getHTML(url, {
      getBrowserless: () => getBrowserContext(t),
      prerender,
      puppeteerOpts: { adblock: false, animations: true }
    })

  test(`${mode} » keep the fragment`, async t => {
    const server = await runRedirectServer(t)
    const url = new URL('/target?a=1#hello', server).toString()
    const { url: resultUrl, html } = await getFragmentResult(t, url)
    t.is(resultUrl, url)
    t.true(html.includes(`<link rel="canonical" href="${url}">`))
  })

  test(`${mode} » a redirect without fragment inherits it`, async t => {
    const server = await runRedirectServer(t)
    const { url, redirects } = await getFragmentResult(t, new URL('/one#hello', server).toString())
    t.is(url, new URL('/target#hello', server).toString())
    t.deepEqual(redirects, [
      { statusCode: 302, url: new URL('/one#hello', server).toString() },
      { statusCode: 302, url: new URL('/two#hello', server).toString() }
    ])
  })

  test(`${mode} » a redirect with its own fragment replaces it`, async t => {
    const server = await runRedirectServer(t)
    const { url } = await getFragmentResult(t, new URL('/own#hello', server).toString())
    t.is(url, new URL('/target#own', server).toString())
  })

  test(`${mode} » a redirect with an empty fragment drops it`, async t => {
    const server = await runRedirectServer(t)
    const { url } = await getFragmentResult(t, new URL('/empty#hello', server).toString())
    t.is(url, new URL('/target#', server).toString())
    const { url: nextHopUrl } = await getFragmentResult(
      t,
      new URL('/empty-then-none#hello', server).toString()
    )
    t.is(nextHopUrl, new URL('/target', server).toString())
  })

  test(`${mode} » a redirect without any fragment stays without it`, async t => {
    const server = await runRedirectServer(t)
    const { url } = await getFragmentResult(t, new URL('/one', server).toString())
    t.is(url, new URL('/target', server).toString())
  })
})

test('fetch » user `beforeRedirect` hooks still run after inheriting the fragment', async t => {
  const server = await runServer(t, (req, res) => {
    if (req.url === '/one') {
      res.statusCode = 302
      res.setHeader('location', '/target')
      return res.end()
    }
    res.end('<!doctype html><title>.</title>')
  })
  const seen = []
  const { url } = await getHTML(new URL('/one#hello', server).toString(), {
    prerender: false,
    gotOpts: { hooks: { beforeRedirect: [options => seen.push(options.url.toString())] } }
  })
  const target = new URL('/target#hello', server).toString()
  t.is(url, target)
  t.deepEqual(seen, [target])
})

test('fetch » a `beforeRedirect` hook that is not an array does not reject', async t => {
  const server = await runServer(t, (req, res) => {
    if (req.url === '/one') {
      res.statusCode = 302
      res.setHeader('location', '/target')
      return res.end()
    }
    res.end('<!doctype html><title>.</title>')
  })
  const url = new URL('/one#hello', server).toString()
  await t.notThrowsAsync(
    getHTML(url, { prerender: false, gotOpts: { hooks: { beforeRedirect: false } } })
  )
})
