'use strict'

const test = require('ava')

const { getDate } = require('../../src/html')

test('from `last-modified`', t => {
  const date = getDate({ 'last-modified': 'Fri, 04 Aug 2023 21:10:56 GMT' })
  t.is(date, '2023-08-04T21:10:56.000Z')
})

test('from `date`', t => {
  const date = getDate({ 'last-modified': 'Sat, 05 Aug 2023 09:43:59 GMT' })
  t.is(date, '2023-08-05T09:43:59.000Z')
})

test('from `age`', t => {
  {
    const date = getDate({ age: '1884' })
    t.truthy(date)
  }
  {
    const date = getDate({})
    t.is(date, undefined)
  }
})
