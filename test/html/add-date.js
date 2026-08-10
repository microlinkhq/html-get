'use strict'

const test = require('ava').default

const createHtml = require('../../src/html')

const LAST_MODIFIED = 'Fri, 04 Aug 2023 21:10:56 GMT'
const DATE = 'Sat, 05 Aug 2023 09:43:59 GMT'
const EMPTY_HTML = '<html><head></head><body></body></html>'

const dates = ({ html = EMPTY_HTML, headers }) =>
  createHtml({ url: 'https://kikobeats.com', html, headers })('meta[name="date"]')
    .map((_, el) => el.attribs.content)
    .get()

test('inject the date from `last-modified`', t => {
  t.deepEqual(dates({ headers: { 'last-modified': LAST_MODIFIED } }), ['2023-08-04T21:10:56.000Z'])
})

test('do not inject a date from `date`', t => {
  t.deepEqual(dates({ headers: { date: DATE } }), [])
})

test('do not inject a date from `age`', t => {
  t.deepEqual(dates({ headers: { age: '1884' } }), [])
})

test('do not duplicate an existing date', t => {
  const html =
    '<html><head><meta name="date" content="2020-01-01T00:00:00.000Z"></head><body></body></html>'

  t.deepEqual(dates({ html, headers: { 'last-modified': LAST_MODIFIED } }), [
    '2020-01-01T00:00:00.000Z'
  ])
})

test('do not shadow an existing `article:published_time`', t => {
  for (const attribute of ['name', 'property']) {
    const html = `<html><head><meta ${attribute}="article:published_time" content="2020-01-01T00:00:00.000Z"></head><body></body></html>`

    t.deepEqual(dates({ html, headers: { 'last-modified': LAST_MODIFIED } }), [])
  }
})
