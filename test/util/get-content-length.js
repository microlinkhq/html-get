'use strict'

const test = require('ava')

const { getContentLength } = require('../../src/util')

const { PDF_SIZE_TRESHOLD } = require('../../src')

const { createHeaders } = require('../helpers')

const contentLength = createHeaders('content-length')

test('parse content length into number', t => {
  {
    const raw = PDF_SIZE_TRESHOLD - PDF_SIZE_TRESHOLD * 0.25
    const input = String(raw)
    const length = getContentLength(contentLength(input))
    t.is(length, raw)
    t.true(length < PDF_SIZE_TRESHOLD)
  }
  {
    const raw = PDF_SIZE_TRESHOLD + PDF_SIZE_TRESHOLD * 0.25
    const input = String(raw)
    const length = getContentLength(contentLength(input))
    t.is(length, raw)
    t.false(length < PDF_SIZE_TRESHOLD)
  }
})

test('returns 0 if value is not present', t => {
  const length = getContentLength(contentLength())
  t.is(length, NaN)
  t.false(length > PDF_SIZE_TRESHOLD)
})
