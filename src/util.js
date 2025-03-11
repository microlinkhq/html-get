'use strict'

const { parse } = require('content-type')

const parseContentType = headers => {
  const value = headers['content-type']
  return typeof value === 'string'
    ? parse(value)
    : { type: undefined, parameters: {} }
}

const getContentType = headers => parseContentType(headers).type

const getCharset = headers =>
  parseContentType(headers).parameters.charset?.toLowerCase()

const getContentLength = headers => Number(headers['content-length'])

module.exports = {
  getCharset,
  getContentLength,
  getContentType
}
