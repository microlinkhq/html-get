'use strict'

const test = require('ava').default

const { getDate } = require('../../src/html')

test('from `last-modified`', t => {
  const date = getDate({ 'last-modified': 'Fri, 04 Aug 2023 21:10:56 GMT' })
  t.is(date, '2023-08-04T21:10:56.000Z')
})

test('ignore `date`', t => {
  t.is(getDate({ date: 'Sat, 05 Aug 2023 09:43:59 GMT' }), undefined)
})

test('ignore `age`', t => {
  t.is(getDate({ age: '1884' }), undefined)
})

test('ignore missing headers', t => {
  t.is(getDate({}), undefined)
  t.is(getDate({ 'last-modified': '' }), undefined)
})

test('`last-modified` takes precedence over `date`', t => {
  const date = getDate({
    'last-modified': 'Fri, 04 Aug 2023 21:10:56 GMT',
    date: 'Sat, 05 Aug 2023 09:43:59 GMT'
  })
  t.is(date, '2023-08-04T21:10:56.000Z')
})
