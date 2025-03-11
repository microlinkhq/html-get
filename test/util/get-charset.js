'use strict'

const test = require('ava')

const { getCharset } = require('../../src/util')

const { createHeaders } = require('../helpers')

const contentType = createHeaders('content-type')

test('returns lower case value detected from content-type', t => {
  t.is(getCharset(contentType('text/html; charset=UTF-8')), 'utf-8')
  t.is(getCharset(contentType('text/html; charset=ISO-8859-1')), 'iso-8859-1')
})

test('returns undefined when charset is not detected', t => {
  t.is(getCharset(contentType('text/html; foo=bar')), undefined)
  t.is(getCharset(contentType('text/html')), undefined)
  t.is(getCharset(contentType('text/html')), undefined)
  t.is(getCharset(contentType('invalid/type')), undefined)
})
