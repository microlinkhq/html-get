'use strict'

const NullProtoObj = require('null-prototype-object')
const { parse } = require('content-type')

const CACHE = new NullProtoObj()

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
