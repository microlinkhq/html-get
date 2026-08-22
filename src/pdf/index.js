'use strict'

const helpers = require('@metascraper/helpers')

const { getAuthor, nameCount } = require('./author')
const { getDescription } = require('./description')
const { getDate } = require('./date')
const { getPublisher } = require('./publisher')
const { getTitle } = require('./title')
const { getLang } = require('./lang')
const { getMedia } = require('./media')
const { headerLines } = require('./layout')
const { readDocument } = require('./document')
const { readEmbedded } = require('./embedded')
const { comparable, isInvertedName } = require('./text')

const PDF_MAGIC = Buffer.from('%PDF')
const PDF_HEAD = 1024
const PDF_PATH = /(?:^|\/)pdf(?:\/|$)/i
const PDF_TYPE = /^(?:pdf|printable)$/i
const MAX_PAGES = 2

const toBytes = input => {
  if (Buffer.isBuffer(input) || ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
  }
  if (input instanceof ArrayBuffer) return new Uint8Array(input)
  return null
}

/** `%PDF` may sit anywhere in the first 1KB; the spec allows leading junk. */
const isPdf = input => {
  const bytes = toBytes(input)
  return Boolean(bytes && Buffer.from(bytes.subarray(0, PDF_HEAD)).includes(PDF_MAGIC))
}

const isPdfLink = url => {
  if (!url || !helpers.isUrl(url)) return false
  if (helpers.isPdfUrl(url)) return true
  try {
    const parsed = new URL(url)
    return PDF_PATH.test(parsed.pathname) || PDF_TYPE.test(parsed.searchParams.get('type') || '')
  } catch (_) {
    return false
  }
}

/** "Surname, Given" is one person; "A, B" is two. */
const firstAuthor = value => {
  if (!value) return null
  const first = value.split(/\s*;\s*/)[0]
  if (isInvertedName(first)) {
    const [surname, given] = first.split(/,\s*/)
    return `${given} ${surname}`
  }
  return first.split(/,\s*/)[0]
}

const appearsIn = (value, text) => {
  const needle = comparable(value)
  return needle.length > 0 && comparable(text).includes(needle)
}

/** A name lifted out of the title block is a title fragment, not an author. */
const withoutContext = (names, context) => {
  if (!names) return null
  const kept = names
    .split(', ')
    .filter(name => !context.some(entry => entry && appearsIn(name, entry)))
  return kept.length > 0 ? kept.join(', ') : null
}

const extract = async ({ url, pdf, maxPages = MAX_PAGES }) => {
  const document = await readDocument(pdf, { maxPages })
  const embedded = readEmbedded(document)
  const rawEmbedded = {
    description: document.info.Subject,
    keywords: document.info.Keywords,
    title: document.info.Title
  }

  const lines = headerLines(document.firstPageLines)
  const layoutTitle = getTitle(lines)

  const title =
    embedded.title && appearsIn(embedded.title, document.text)
      ? embedded.title
      : layoutTitle?.text || embedded.title

  const layoutAuthor = withoutContext(
    getAuthor(lines, {
      titleIndexes: layoutTitle?.indexes || []
    }),
    [title]
  )
  const authors =
    nameCount(layoutAuthor) > nameCount(embedded.author)
      ? layoutAuthor
      : embedded.author || layoutAuthor

  const author = firstAuthor(authors)
  const publisher = embedded.publisher || getPublisher(lines, { url, title, author: authors })
  const description = embedded.description || getDescription(document.lines)
  const date = getDate(url, {
    lines: document.firstPageLines,
    text: document.text,
    embedded,
    rawEmbedded
  })
  const lang = getLang(document.text, { url, embedded })
  const { image, logo } = getMedia(document.images, { url })

  return {
    title,
    author,
    authors,
    description,
    publisher,
    date,
    lang,
    image,
    logo
  }
}

const extractSafe = async (input, url, opts) => {
  const pdf = toBytes(input)
  if (!isPdf(pdf)) return
  try {
    return await extract({ url, pdf, ...opts })
  } catch (_) {}
}

module.exports = {
  extract,
  extractSafe,
  isPdf,
  isPdfLink,
  toBytes
}
