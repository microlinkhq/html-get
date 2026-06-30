'use strict'

// Office document formats Pandoc reads natively (no LibreOffice needed). Each is
// converted to HTML at fetch time, so the rest of the pipeline (metadata,
// markdown, screenshot) treats the document like a regular web page.
//
// Legacy OLE binaries (.doc/.xls/.ppt) and OpenDocument spreadsheet/presentation
// (.ods/.odp) are intentionally absent: Pandoc can't read them, they need a
// headless LibreOffice in the container.
const OFFICE_FORMATS = {
  docx: {
    extensions: ['docx'],
    contentTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  },
  xlsx: {
    extensions: ['xlsx'],
    contentTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  },
  pptx: {
    extensions: ['pptx'],
    contentTypes: [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]
  },
  odt: {
    extensions: ['odt'],
    contentTypes: ['application/vnd.oasis.opendocument.text']
  },
  rtf: {
    extensions: ['rtf'],
    contentTypes: ['application/rtf', 'text/rtf']
  },
  epub: {
    extensions: ['epub'],
    contentTypes: ['application/epub+zip']
  }
}

const byContentType = new Map()
const byExtension = new Map()

for (const [format, { contentTypes, extensions }] of Object.entries(
  OFFICE_FORMATS
)) {
  for (const contentType of contentTypes) byContentType.set(contentType, format)
  for (const extension of extensions) byExtension.set(extension, format)
}

const getUrlExtension = url => {
  const clean = String(url).split('?')[0].split('#')[0]
  const index = clean.lastIndexOf('.')
  if (index === -1) return ''
  const extension = clean.slice(index + 1).toLowerCase()
  return /^[a-z0-9]+$/.test(extension) ? extension : ''
}

const getOfficeFormatFromUrl = url => byExtension.get(getUrlExtension(url))

// Content-types that positively identify a web page or media. They are
// authoritative: the URL extension must never override them (e.g. an HTML page
// served at a `.docx` vanity URL is still a web page, not an office document).
const isWebContentType = type =>
  /^(text\/html|application\/xhtml\+xml|application\/json|image\/|audio\/|video\/)/.test(
    type || ''
  )

// Resolve the Pandoc `--from` format for a document:
//   1. an explicit office content-type wins
//   2. an explicit web/media content-type means "not an office document"
//   3. otherwise the content-type is non-committal (octet-stream, zip, missing,
//      or a mislabeled binary type) so the URL extension decides; `url` may be a
//      list of candidates, tried in order (e.g. final URL then original request
//      URL after a redirect)
const getOfficeFormat = ({ contentType, url } = {}) => {
  const byType = byContentType.get(contentType)
  if (byType) return byType
  if (isWebContentType(contentType)) return undefined
  const candidates = Array.isArray(url) ? url : [url]
  for (const candidate of candidates) {
    const format = candidate && getOfficeFormatFromUrl(candidate)
    if (format) return format
  }
  return undefined
}

const isOfficeUrl = url => byExtension.has(getUrlExtension(url))

module.exports = { OFFICE_FORMATS, getOfficeFormat, isOfficeUrl }
