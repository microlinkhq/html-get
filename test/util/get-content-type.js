'use strict'

const test = require('ava')

const { getContentType } = require('../../src/util')

const { createHeaders } = require('../helpers')

const contentType = createHeaders('content-type')

test('return media type', t => {
  t.is(
    getContentType(contentType('application/pdf; charset=utf-8')),
    'application/pdf'
  )
  t.is(
    getContentType(contentType('APPLICATION/PDF; charset=utf-8')),
    'application/pdf'
  )
  t.is(
    getContentType(contentType('INVALID/TYPE; charset=utf-8')),
    'invalid/type'
  )
})

test('handle comma-duplicated content-type headers', t => {
  t.is(getContentType(contentType('text/html,text/html')), 'text/html')
  t.is(
    getContentType(
      contentType(
        'application/pdf; charset=utf-8,application/pdf; charset=utf-8'
      )
    ),
    'application/pdf'
  )
})

test('handle CRLF-duplicated content-type headers', t => {
  t.is(getContentType(contentType('text/html\r\ntext/html')), 'text/html')
})

test('return undefined for invalid media type instead of throwing', t => {
  t.is(getContentType(contentType('')), undefined)
  t.is(getContentType(contentType('not-a-media-type')), undefined)
  t.is(getContentType({}), undefined)
})
