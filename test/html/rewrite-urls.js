'use strict'

const path = require('path')
const test = require('ava').default
const fs = require('fs')

const { prettyHtml } = require('../helpers')

const html = (...args) => require('../../src/html')(...args).html()

test('remove localhost alike URLs', t => {
  const output = html({
    rewriteUrls: true,
    url: 'https://kikobeats.com',
    html: `
    <html lang="en">
      <head>
       <title>kikobeats.com</title>
       <meta property="og:site_name" content="kikobeats.com">
       <link rel="canonical" href="https://kikobeats.com/">
       <meta charset="utf-8">
      </head>
      <body>
        <script async="" src="/testfile" id="livereloadscript"></script>
        <script async="" src="http://localhost:35729/livereload.js?snipver=1" id="livereloadscript"></script>
        <script async="" src="http://127.0.0.1:35729/livereload.js?snipver=1" id="livereloadscript"></script>
        <script async="" src="http://0.0.0.1:35729/livereload.js?snipver=1" id="livereloadscript"></script>
        <a href="mailto:example@example.com">Email</a>
        <a href="ftp://example.com/file.txt">FTP Link</a>
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==" alt="Base64 Image">
      </body>
    </html>`,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  })

  t.snapshot(prettyHtml(output))
})

test('rewrites relative root URLs inside html markup', t => {
  const output = html({
    rewriteUrls: true,
    url: 'https://browserless.js.org',
    html: fs.readFileSync(path.resolve(__dirname, '../fixtures/browserless.html'), 'utf8'),
    headers: {
      'content-type': 'text/html; charset=utf-8'
    }
  })

  t.true(output.includes('https://browserless.js.org/static/main.min.js'))
  t.true(output.includes('https://unpkg.com/docsify/lib/docsify.min.js'))

  t.snapshot(prettyHtml(output))
})

test('rewrites relative URLs inside html markup', t => {
  const output = html({
    rewriteUrls: true,
    url: 'https://moovility.me/',
    html: `<!DOCTYPE html>
    <html>
    <head>
      <link rel="apple-touch-icon" href="img/icons/MOV/icon2-76.png" sizes="76x76">
    </head>
    <body></body>
    </html>`,
    headers: {
      'content-type': 'text/html; charset=utf-8'
    }
  })

  t.true(output.includes('https://moovility.me/img/icons/MOV/icon2-76.png'))

  t.snapshot(prettyHtml(output))
})

test(" don't modify inline javascript", t => {
  const output = html({
    rewriteUrls: true,
    url: 'https://www.latimes.com/opinion/story/2020-06-07/column-muralist-honors-african-americans-killed-by-police',
    html: `
    <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
<a class="ActionLink" data-social-service="print" href="javascript:window.print()"><svg><use xlink:href="#mono-icon-print"></use></svg><span>Print</span></a>
</body>
</html>`,
    headers: {
      'content-type': 'text/html;charset=UTF-8'
    }
  })

  t.true(
    output.includes(
      '<a class="ActionLink" data-social-service="print" href="javascript:window.print()"><svg><use xlink:href="#mono-icon-print"></use></svg><span>Print</span></a>'
    )
  )

  t.snapshot(prettyHtml(output))
})

test("don't modify non http protocols", t => {
  const output = html({
    rewriteUrls: true,
    url: 'https://www.latimes.com/opinion/story/2020-06-07/column-muralist-honors-african-americans-killed-by-police',
    html: `
    <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
<a href="mailto:jen@oreilly.com"></a>
<a href="ftp://user:password@server/pathname"></a>
<a href="file://server/path"></a>
<a href="nntp://server:port/newsgroup/article"></a>
<a href="telnet://user:password@server:port/"/></a>
<a href="gopher://docstore.mik.ua/orelly.htm"></a>
</body>
</html>`,
    headers: {
      'content-type': 'text/html;charset=UTF-8'
    }
  })

  t.true(output.includes('<a href="mailto:jen@oreilly.com"></a>'))
  t.true(output.includes('<a href="ftp://user:password@server/pathname"></a>'))
  t.true(output.includes('<a href="file://server/path'))
  t.true(output.includes('<a href="nntp://server:port/newsgroup/article"></a>'))
  t.true(output.includes('<a href="telnet://user:password@server:port/"></a>'))
  t.true(output.includes('<a href="gopher://docstore.mik.ua/orelly.htm"></a>'))

  t.snapshot(prettyHtml(output))
})

test("don't modify data URIs", t => {
  const output = html({
    rewriteUrls: true,
    url: 'https://example.com',
    html: `
    <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
<img src="data:image/gif;base64,R0lGODlhEAAQAMQAAORHHOVSKudfOulrSOp3WOyDZu6QdvCchPGolfO0o/XBs/fNwfjZ0frl3/zy7////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH5BAkAABAALAAAAAAQABAAAAVVICSOZGlCQAosJ6mu7fiyZeKqNKToQGDsM8hBADgUXoGAiqhSvp5QAnQKGIgUhwFUYLCVDFCrKUE1lBavAViFIDlTImbKC5Gm2hB0SlBCBMQiB0UjIQA7" alt="star" width="16" height="16">
</body>
</html>`,
    headers: {
      'content-type': 'text/html;charset=UTF-8'
    }
  })

  t.true(
    output.includes(
      '<img src="data:image/gif;base64,R0lGODlhEAAQAMQAAORHHOVSKudfOulrSOp3WOyDZu6QdvCchPGolfO0o/XBs/fNwfjZ0frl3/zy7////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH5BAkAABAALAAAAAAQABAAAAVVICSOZGlCQAosJ6mu7fiyZeKqNKToQGDsM8hBADgUXoGAiqhSvp5QAnQKGIgUhwFUYLCVDFCrKUE1lBavAViFIDlTImbKC5Gm2hB0SlBCBMQiB0UjIQA7" alt="star" width="16" height="16">'
    )
  )

  t.snapshot(prettyHtml(output))
})

test('keeps rewriting the other url attributes on an element', t => {
  const output = html({
    rewriteUrls: true,
    url: 'https://example.com/dir/page',
    html: `
      <a href="mailto:a@b.c" ping="/track">mail</a>
      <a ping="/only">ping</a>
      <a href="http://[" ping="/next">bad</a>
      <a href="javascript:alert(1)" ping="/script">js</a>
      <a href="/ok" ping="https://example.com/p">both</a>
      <input type="image" src="/a.png" formaction="/submit">
      <A HREF="/Up" PING="/upper">U</A>
      <svg><a href="/svg">s</a><image href="/img.svg"></image></svg>
    `,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  })

  t.true(output.includes('href="mailto:a@b.c"'))
  t.true(output.includes('ping="https://example.com/track"'))
  t.true(output.includes('ping="https://example.com/only"'))
  t.true(output.includes('href="http://["'))
  t.true(output.includes('ping="https://example.com/next"'))
  t.true(output.includes('href="javascript:alert(1)"'))
  t.true(output.includes('ping="https://example.com/script"'))
  t.true(output.includes('href="https://example.com/ok"'))
  t.true(output.includes('ping="https://example.com/p"'))
  t.true(output.includes('src="https://example.com/a.png"'))
  t.true(output.includes('formaction="https://example.com/submit"'))
  t.true(output.includes('href="https://example.com/Up"'))
  t.true(output.includes('ping="https://example.com/upper"'))
  t.true(output.includes('href="https://example.com/svg"'))
  t.true(output.includes('href="/img.svg"'))
})

test('removes an element when any of its url attributes is local', t => {
  const output = html({
    rewriteUrls: true,
    url: 'https://example.com/dir/page',
    html: `
      <a href="/ok" ping="http://127.0.0.1/x">local-later</a>
      <a href="http://localhost/x" ping="/track">local-first</a>
      <a href="/stay">stay</a>
      <video poster="http://127.0.0.1/p.jpg" src="/movie.mp4"></video>
      <input type="image" src="/kept.png" formaction="http://10.0.0.1/submit">
      <div><a href="http://192.168.0.1/a"><img src="/nested.png"></a></div>
    `,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  })

  t.false(output.includes('local-later'))
  t.false(output.includes('local-first'))
  t.false(output.includes('127.0.0.1'))
  t.false(output.includes('localhost'))
  t.false(output.includes('10.0.0.1'))
  t.false(output.includes('192.168.0.1'))
  t.false(output.includes('movie.mp4'))
  t.false(output.includes('kept.png'))
  t.false(output.includes('nested.png'))
  t.true(output.includes('href="https://example.com/stay"'))
})

test.serial('stops at the attribute that removes the element', t => {
  const localPath = require.resolve('is-local-address')
  const real = require(localPath)
  const hosts = []
  require.cache[localPath].exports = host => {
    hosts.push(host)
    return real(host)
  }
  const htmlPath = require.resolve('../../src/html')
  delete require.cache[htmlPath]

  try {
    const output = require(htmlPath)({
      rewriteUrls: true,
      url: 'https://example.com/dir/page',
      headers: { 'content-type': 'text/html' },
      html: '<a href="http://127.0.0.1/a" ping="https://example.com/p">x</a>'
    }).html()
    t.false(output.includes('127.0.0.1'))
    t.false(output.includes('example.com/p'))
    t.deepEqual(hosts, ['127.0.0.1'])
  } finally {
    require.cache[localPath].exports = real
    delete require.cache[htmlPath]
  }
})

test("don't modify undefined attributes", t => {
  const output = html({
    rewriteUrls: true,
    url: 'https://moovility.me',
    html: `
    <!DOCTYPE html>
<html lang="en">
<head>
  <title>Document</title>
</head>
<body>
  <script>console.log('greetings')</script>
</body>
</html>`,
    headers: {
      'content-type': 'text/html;charset=UTF-8'
    }
  })

  t.true(output.includes("<script>console.log('greetings')</script>"))

  t.snapshot(prettyHtml(output))
})
