'use strict'

const { getBrowserContext, runServer, test } = require('./helpers')

const getHTML = require('..')

const getUrl = t =>
  runServer(t, (_, res) => {
    res.setHeader('content-type', 'text/html')
    res.end(`<!DOCTYPE html>
<html>
<head>
  <script>
    class MyRow extends HTMLElement {
      connectedCallback() {
        const shadow = this.attachShadow({ mode: 'open' })
        const name = this.getAttribute('name') || ''
        const value = this.getAttribute('value') || ''
        shadow.innerHTML = '<div class="row"><span>' + name + '</span><span>' + value + '</span></div>'
      }
    }
    customElements.define('my-row', MyRow)
  </script>
</head>
<body>
  <h1>Shadow DOM Table</h1>
  <div id="table">
    <my-row name="Alice" value="100"></my-row>
    <my-row name="Bob" value="200"></my-row>
    <my-row name="Charlie" value="300"></my-row>
  </div>
</body>
</html>`)
  })

test('shadow DOM content is flattened by default in prerender mode', async t => {
  const url = await getUrl(t)
  const result = await getHTML(String(url), {
    prerender: true,
    getBrowserless: () => getBrowserContext(t),
    puppeteerOpts: { adblock: false }
  })

  const html = result.html
  t.true(html.includes('Alice'))
  t.true(html.includes('Bob'))
  t.true(html.includes('Charlie'))
  t.true(html.includes('100'))
  t.true(html.includes('200'))
  t.true(html.includes('300'))
})

test('auto mode upgrades to prerender when shadow DOM is detected', async t => {
  const url = await getUrl(t)
  const result = await getHTML(String(url), {
    prerender: 'auto',
    getBrowserless: () => getBrowserContext(t),
    puppeteerOpts: { adblock: false }
  })

  t.is(result.stats.mode, 'prerender')
  const html = result.html
  t.true(html.includes('Alice'))
  t.true(html.includes('Bob'))
  t.true(html.includes('Charlie'))
})

test('explicit prerender:false is not upgraded despite shadow DOM', async t => {
  const url = await getUrl(t)
  const result = await getHTML(String(url), {
    prerender: false,
    getBrowserless: () => getBrowserContext(t),
    puppeteerOpts: { adblock: false }
  })

  // shadow DOM is present but the explicit opt-out must win: no prerender retry
  t.is(result.stats.mode, 'fetch')
  t.true(result.stats.shadowDOM)
  t.true(result.html.includes('<my-row'))
})

test('auto mode does not upgrade for SVG hyphenated tags', async t => {
  const url = await runServer(t, (_, res) => {
    res.setHeader('content-type', 'text/html')
    res.end(`<!DOCTYPE html>
<html>
<body>
  <svg><font-face /></svg>
  <p id="content">plain fetch content</p>
</body>
</html>`)
  })

  const result = await getHTML(String(url), {
    prerender: 'auto',
    getMode: () => 'fetch',
    getBrowserless: () => getBrowserContext(t),
    puppeteerOpts: { adblock: false }
  })

  t.is(result.stats.mode, 'fetch')
  t.false(result.stats.shadowDOM)
  t.true(result.html.includes('plain fetch content'))
})

test('auto mode keeps fetch result when prerender retry fails', async t => {
  let hits = 0
  const url = await runServer(t, (_, res) => {
    hits++
    res.setHeader('content-type', 'text/html')
    if (hits === 1) {
      return res.end(`<!DOCTYPE html>
<html>
<head>
  <script>
    class MyRow extends HTMLElement {
      connectedCallback() {
        const shadow = this.attachShadow({ mode: 'open' })
        shadow.innerHTML = '<div class="row"><span>Alice</span></div>'
      }
    }
    customElements.define('my-row', MyRow)
  </script>
</head>
<body>
  <h1>Shadow DOM Table</h1>
  <my-row></my-row>
</body>
</html>`)
    }
    res.statusCode = 500
    res.end('origin down')
  })

  const failingBrowserless = () => ({
    evaluate: () => async () => {
      throw new Error('browser blocked')
    }
  })

  const result = await getHTML(String(url), {
    prerender: 'auto',
    getMode: () => 'fetch',
    getBrowserless: failingBrowserless,
    puppeteerOpts: { adblock: false }
  })

  t.is(result.stats.mode, 'fetch')
  t.true(result.html.includes('Shadow DOM Table'))
})
