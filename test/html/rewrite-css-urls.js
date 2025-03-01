'use strict'

const execall = require('execall')
const test = require('ava')

const { prettyHtml } = require('../util')

const html = (...args) => require('../../src/html')(...args).html()

test("don't modify html markup", t => {
  const output = html({
    rewriteUrls: true,
    url: 'https://www.rubiomonocoatusa.com/blogs/blog/how-to-apply-oil-plus-2c-to-furniture',
    html: `<!DOCTYPE html>
<html>
<head>
  <style>body { background: url(//cdn.shopify.com/s/files/1/0260/4810/2497/articles/Applying-Oil-Plus-2C-to-a-table_600x.jpg?v=1616464305) }</style>
  <meta property="og:image" content="http://cdn.shopify.com/s/files/1/0260/4810/2497/articles/Applying-Oil-Plus-2C-to-a-table_600x.jpg?v=1616464305">
</head>
<body></body>
</html>`,
    headers: {
      'content-type': 'text/html; charset=utf-8'
    }
  })

  t.snapshot(prettyHtml(output))
})

test('rewrites relative URLs inside stylesheet', t => {
  const output = html({
    rewriteUrls: true,
    url: 'https://kikobeats.com',
    html: `
    <html lang="en">
      <body>
        <div style="background-image: url(/images/microlink.jpg)"></div>
        <div style="background-image: url(/images/microlink.jpg)"></div>
      </body>
    </html>
    `,
    headers: {
      'content-type': 'text/html; charset=utf-8'
    }
  })

  const results = execall(
    /https:\/\/kikobeats.com\/images\/microlink\.jpg/g,
    output
  )

  t.is(results.length, 2)
  t.snapshot(prettyHtml(output))
})
