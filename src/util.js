'use strict'

const NullProtoObj = require('null-prototype-object')
const { parse } = require('content-type')

const CACHE_SIZE = 1000

let cache = new NullProtoObj()
let cacheSize = 0

const UNKNOWN_CONTENT_TYPE = { type: undefined, parameters: {} }

const SEPARATOR = /,|\r?\n/

const parseContentType = contentType => {
  if (typeof contentType !== 'string') return UNKNOWN_CONTENT_TYPE
  const parsed = parse(contentType.split(SEPARATOR)[0])
  return parsed.type?.includes('/') ? parsed : UNKNOWN_CONTENT_TYPE
}

const contentType = headers => {
  const contentType = headers['content-type']
  const cached = cache[contentType]
  if (cached !== undefined) return cached
  if (++cacheSize > CACHE_SIZE) {
    cache = new NullProtoObj()
    cacheSize = 1
  }
  return (cache[contentType] = parseContentType(contentType))
}

const getContentType = headers => contentType(headers).type

const getCharset = headers => contentType(headers).parameters.charset?.toLowerCase()

const getContentLength = headers => Number(headers['content-length'])

module.exports = {
  getCharset,
  getContentLength,
  getContentType
}
