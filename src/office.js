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

// Resolve the Pandoc `--from` format for a document, preferring its declared
// content-type and falling back to the URL extension (many CDNs serve office
// files as application/octet-stream).
const getOfficeFormat = ({ contentType, url } = {}) =>
  byContentType.get(contentType) ||
  (url ? getOfficeFormatFromUrl(url) : undefined)

const isOfficeUrl = url => byExtension.has(getUrlExtension(url))

module.exports = { OFFICE_FORMATS, getOfficeFormat, isOfficeUrl }
