'use strict'

const { defaultMutoolPath: getMutoolPath } = require('../src/index')
const { readFile, readdir } = require('fs/promises')
const $ = require('tinyspawn')
const path = require('path')

const OUTPUT = path.join(__dirname, 'output.pdf')

class Benchmark {
  constructor (title) {
    this.title = title
    this.testCases = []
    this.results = []
    this.verifications = []
  }

  add (name, fn) {
    this.testCases.push({ name, fn })
    return this
  }

  verification (fn) {
    this.verifications.push(fn)
    return this
  }

  async run () {
    console.log(`\n${this.title}\n`)

    for (const [index, { name, fn }] of this.testCases
      .sort(() => Math.random() - 0.5)
      .entries()) {
      const start = Date.now()
      const result = await fn()
      for (const verification of this.verifications) {
        try {
          verification(result)
        } catch (error) {
          throw new Error(`Verification failed for '${name}': ${error.message}`)
        }
      }
      const duration = Date.now() - start
      this.results.push({ name, duration, result })
      console.log(`${index + 1}. ${name}: ${duration}ms`)
    }

    const { name, duration } = this.results.reduce(
      (prev, curr, idx) =>
        prev.duration < curr.duration ? prev : { ...curr, index: idx },
      { duration: Infinity }
    )
    const [fastest, secondFastest] = this.results.sort(
      (a, b) => a.duration - b.duration
    )

    const percentageFaster =
      ((secondFastest.duration - fastest.duration) / secondFastest.duration) *
      100

    console.log(
      `\nFastest: "${name}" with ${duration}ms (${percentageFaster.toFixed(
        2
      )}%)`
    )
  }
}

const main = async () => {
  const mutoolPath = getMutoolPath()

  const fixtures = await readdir(path.join(__dirname, 'fixtures'))

  for (const filename of fixtures) {
    const filepath = path.join(__dirname, 'fixtures', filename)

    await new Benchmark(`Benchmarking mutool ${filename}`)
      .verification(output => {
        if (typeof output !== 'string') {
          throw new TypeError(`Expected a string, got ${typeof output}`)
        }
      })
      .add('write in memory', async () => {
        const result = await $(`${mutoolPath} draw -q -F html ${filepath}`)
        return result.stdout
      })
      .add('write in file, read async', async () => {
        await $(`${mutoolPath} draw -q -F html -o ${OUTPUT} ${filepath}`)
        return readFile(OUTPUT, 'utf-8')
      })
      .run()
  }
}

main()
