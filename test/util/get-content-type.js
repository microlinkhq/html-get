'use strict'

const test = require('ava').default

const { getContentType } = require('../../src/util')

const { createHeaders } = require('../helpers')

const contentType = createHeaders('content-type')

test('return media type', t => {
  t.is(getContentType(contentType('application/pdf; charset=utf-8')), 'application/pdf')
  t.is(getContentType(contentType('APPLICATION/PDF; charset=utf-8')), 'application/pdf')
  t.is(getContentType(contentType('INVALID/TYPE; charset=utf-8')), 'invalid/type')
})

test('handle comma-duplicated content-type headers', t => {
  t.is(getContentType(contentType('text/html,text/html')), 'text/html')
  t.is(
    getContentType(contentType('application/pdf; charset=utf-8,application/pdf; charset=utf-8')),
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

test('evicts content-type entries after 1000 distinct headers', t => {
  // content-type's ESM export is read-only, so count parses by wrapping require.
  const Module = require('module')
  const originalLoad = Module._load
  const originalParse = require('content-type').parse
  let parses = 0
  Module._load = function (request, parent, isMain) {
    if (request === 'content-type') {
      return {
        parse: (...args) => {
          parses++
          return originalParse(...args)
        }
      }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  const utilPath = require.resolve('../../src/util')
  delete require.cache[utilPath]

  try {
    const { getCharset, getContentType: fresh } = require('../../src/util')
    const marker = contentType('text/html; charset=UTF-8')

    // CACHE_SIZE is 1000: the marker plus 999 new keys fills it without eviction.
    fresh(marker)
    for (let i = 0; i < 999; i++) fresh(contentType(`text/plain; id=${i}`))
    const filled = parses
    fresh(marker)
    t.is(parses, filled)
    t.is(fresh(marker), 'text/html')
    t.is(getCharset(marker), 'utf-8')

    fresh(contentType('text/plain; id=overflow'))
    const overflowed = parses
    fresh(marker)
    t.is(parses, overflowed + 1)
    t.is(fresh(marker), 'text/html')
    t.is(getCharset(marker), 'utf-8')
    t.is(parses, overflowed + 1)

    fresh(contentType('text/plain; id=0'))
    t.is(parses, overflowed + 2)
    t.is(fresh({}), undefined)
    t.is(fresh(contentType('application/pdf; charset=utf-8')), 'application/pdf')
  } finally {
    Module._load = originalLoad
    delete require.cache[utilPath]
  }
})
