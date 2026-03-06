'use strict'

const test = require('ava')

const { getCharset } = require('../../src/util')

const { createHeaders } = require('../helpers')

const contentType = createHeaders('content-type')

test('returns lower case value detected from content-type', t => {
  t.is(getCharset(contentType('text/html; charset=UTF-8')), 'utf-8')
  t.is(getCharset(contentType('text/html; charset=ISO-8859-1')), 'iso-8859-1')
  t.is(
    getCharset(
      contentType('text/html; charset=utf-8\ntext/html; charset=utf-8')
    ),
    'utf-8'
  )
})

test('handles comma-duplicated content-type headers', t => {
  t.is(
    getCharset(
      contentType('text/html; charset=utf-8,text/html; charset=utf-8')
    ),
    'utf-8'
  )
  t.is(getCharset(contentType('text/html,text/html')), undefined)
})

test('returns undefined when charset is not detected', t => {
  t.is(getCharset(contentType('text/html; foo=bar')), undefined)
  t.is(getCharset(contentType('text/html')), undefined)
  t.is(getCharset(contentType('text/html')), undefined)
  t.is(getCharset(contentType('invalid/type')), undefined)
})

test('returns undefined for invalid media type instead of throwing', t => {
  t.is(getCharset(contentType('')), undefined)
  t.is(getCharset(contentType('not-a-media-type')), undefined)
  t.is(getCharset({}), undefined)
})
