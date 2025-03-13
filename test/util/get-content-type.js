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
