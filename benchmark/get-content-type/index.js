'use strict'

const NullProtoObj = require('null-prototype-object')
const { parse } = require('content-type')

const parseContentType = contentType =>
  typeof contentType === 'string'
    ? parse(contentType)
    : { type: undefined, parameters: {} }

const createContentTypeFunction = useCache => {
  const CACHE = useCache ? new NullProtoObj() : null

  return headers => {
    const contentType = headers['content-type']
    if (useCache) {
      return (
        CACHE[contentType] ||
        (CACHE[contentType] = parseContentType(contentType))
      )
    } else {
      return parseContentType(contentType)
    }
  }
}

// Benchmark function
const benchmark = (iterations, useCache) => {
  const headersList = [
    { 'content-type': 'application/json; charset=utf-8' },
    { 'content-type': 'text/html; charset=utf-8' },
    { 'content-type': 'application/xml; charset=utf-8' },
    { 'content-type': 'text/plain; charset=utf-8' },
    { 'content-type': 'application/json' }
  ]

  const contentTypeFunc = createContentTypeFunction(useCache)

  console.time(useCache ? 'Benchmark with Cache' : 'Benchmark without Cache')
  for (let i = 0; i < iterations; i++) {
    for (const headers of headersList) {
      contentTypeFunc(headers)
    }
  }
  console.timeEnd(useCache ? 'Benchmark with Cache' : 'Benchmark without Cache')
}

// Run the benchmark
const iterations = 100000
benchmark(iterations, false) // Without Cache
benchmark(iterations, true) // With Cache
