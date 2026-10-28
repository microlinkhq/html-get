import getHTML from '../index.js'
import type {
  HtmlGetResult,
  HtmlGetContent,
  HtmlGetOptions,
  GetContentOptions,
  PdfMeta,
  Pandoc,
  Mutool
} from '../index.js'

const options: HtmlGetOptions = { prerender: false, rewriteUrls: true, pandoc: false }
const request = getHTML('https://example.com', options)
request.cancel()
const result: HtmlGetResult = await request
const status: number | undefined = result.statusCode
const mode: 'fetch' | 'prerender' = result.stats.mode
const shadowDOM: boolean = result.stats.shadowDOM

const contentOptions: GetContentOptions = { mutool: false, toEncode: (content: Uint8Array) => new TextDecoder().decode(content) }
const content: HtmlGetContent = await getHTML.getContent('https://example.com', 'fetch', contentOptions)
const title: string = content.$('title').text()

const meta: PdfMeta | undefined = await getHTML.extractPdfSafe(new Uint8Array(), 'https://example.com/a.pdf')
const pandoc: Pandoc | undefined = getHTML.defaultPandoc()
const mutool: Mutool | undefined = getHTML.defaultMutool()
const paths: Array<string | undefined> = [getHTML.getPandocPath(), getHTML.getMutoolPath()]
const flags: boolean[] = [getHTML.isFetchMode('https://example.com'), getHTML.isPdf(new Uint8Array()), getHTML.isPdfLink('https://example.com/a.pdf')]
const numbers: number[] = [getHTML.REQ_TIMEOUT, getHTML.PDF_SIZE_TRESHOLD]
const abortTypes: string[] = getHTML.ABORT_TYPES
const html: string = await getHTML.pdfToHtml(new Uint8Array(), 'https://example.com/a.pdf')
const extracted: PdfMeta = await getHTML.extractPdf({ url: 'https://example.com/a.pdf', pdf: new Uint8Array() })

console.log(status, mode, shadowDOM, title, meta, pandoc, mutool, paths, flags, numbers, abortTypes, html, extracted)

type HasDefault = 'default' extends keyof typeof getHTML ? true : false
const hasDefault: HasDefault = false

// @ts-expect-error the result has no top-level mode, it lives in stats
console.log(result.mode, hasDefault)
// @ts-expect-error the module exports no htmlGet member
console.log(getHTML.htmlGet)
// @ts-expect-error the serialized result has no Cheerio instance
console.log(result.$)
// @ts-expect-error without toEncode, fetch mode drops the response
getHTML.getContent('https://example.com', 'fetch', {})
