'use strict'

const test = require('ava').default

const createHtml = require('../../src/html')

const EMPTY_HTML = '<html><head></head><body></body></html>'

const head = ({ html = EMPTY_HTML, headers = {} }) =>
  createHtml({ url: 'https://kikobeats.com', html, headers })('head').html()

test('do not infer a date from response headers', t => {
  const headers = {
    age: '1884',
    date: 'Sat, 05 Aug 2023 09:43:59 GMT',
    'last-modified': 'Fri, 04 Aug 2023 21:10:56 GMT'
  }

  t.false(head({ headers }).includes('name="date"'))
})

test('preserve a date present in the markup', t => {
  const html =
    '<html><head><meta name="date" content="2020-01-01T00:00:00.000Z"></head><body></body></html>'

  t.true(head({ html }).includes('content="2020-01-01T00:00:00.000Z"'))
})
