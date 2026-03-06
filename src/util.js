'use strict'

const NullProtoObj = require('null-prototype-object')
const { parse } = require('content-type')
const { EOL } = require('node:os')

const CACHE = new NullProtoObj()

const UNKNOWN_CONTENT_TYPE = { type: undefined, parameters: {} }

const parseContentType = contentType => {
  if (typeof contentType !== 'string') return UNKNOWN_CONTENT_TYPE
  try {
    return parse(contentType.split(',')[0].split(EOL)[0])
  } catch {
    return UNKNOWN_CONTENT_TYPE
  }
}

const contentType = headers => {
  const contentType = headers['content-type']
  return (
    CACHE[contentType] || (CACHE[contentType] = parseContentType(contentType))
  )
}

const getContentType = headers => contentType(headers).type

const getCharset = headers =>
  contentType(headers).parameters.charset?.toLowerCase()

const getContentLength = headers => Number(headers['content-length'])

module.exports = {
  getCharset,
  getContentLength,
  getContentType
}
