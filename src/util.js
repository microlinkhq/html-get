'use strict'

const { parse } = require('content-type')

const CACHE = Object.create(null)

const parseContentType = contentType =>
  typeof contentType === 'string'
    ? parse(contentType)
    : { type: undefined, parameters: {} }

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
