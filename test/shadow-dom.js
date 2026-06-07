'use strict'

const { getBrowserContext, runServer } = require('@browserless/test')
const test = require('ava')

const getHTML = require('..')

const getUrl = t =>
  runServer(t, ({ res }) => {
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
  const result = await getHTML(url, {
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
