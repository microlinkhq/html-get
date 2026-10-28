import type { CheerioAPI } from 'cheerio'
import PCancelable = require('p-cancelable')

declare namespace htmlGet {
  /**
   * Result returned by html-get
   */
  interface HtmlGetResult {
    /** The HTML content */
    html: string
    /** Response headers */
    headers: Record<string, string | string[] | undefined>
    /** Final URL after redirects */
    url: string
    /** HTTP status code */
    statusCode: number | undefined
    /** Redirect history */
    redirects: Array<{ statusCode: number; url: string }>
    /** Statistics about the request */
    stats: {
      mode: 'fetch' | 'prerender'
      timing: number
      shadowDOM: boolean
    }
  }

  interface HtmlGetContent extends Omit<HtmlGetResult, 'stats'> {
    /** Mode used: 'fetch' or 'prerender' */
    mode: 'fetch' | 'prerender'
    /** Parsed HTML (Cheerio) */
    $: CheerioAPI
  }

  type Pandoc = (format: string, filepath: string) => Promise<string | undefined>

  type Mutool = (...args: string[]) => any

  /**
   * Options for html-get
   */
  interface HtmlGetOptions {
    /** Character encoding for HTML (default: 'utf-8') */
    encoding?: string
    /** Function that returns a browserless instance (required unless prerender is false) */
    getBrowserless?: () => Promise<any>
    /** Function to determine the mode ('fetch' or 'prerender') */
    getMode?: (url: string, options: { prerender: boolean | 'auto' }) => 'fetch' | 'prerender'
    /** Function to create temporary files */
    getTemporalFile?: (input: string, ext?: string) => { path: string }
    /** Options passed to got (the HTTP client) */
    gotOpts?: Record<string, any>
    /** Request headers */
    headers?: Record<string, string>
    /** Mutool function for PDF processing, or false to disable */
    mutool?: Mutool | false
    /** Pandoc function for office documents, or false to disable */
    pandoc?: Pandoc | false
    /** Prerender mode: true, false, or 'auto' (default) */
    prerender?: boolean | 'auto'
    /** Options passed to Puppeteer */
    puppeteerOpts?: Record<string, any>
    /** Rewrite relative URLs to absolute */
    rewriteUrls?: boolean
    /** Rewrite common HTML meta tag mistakes */
    rewriteHtml?: boolean
    /** Function to serialize HTML (default: $ => ({ html: $.html() })) */
    serializeHtml?: ($: CheerioAPI) => { html: string }
  }

  interface GetContentOptions
    extends Pick<
      HtmlGetOptions,
      | 'getBrowserless'
      | 'getTemporalFile'
      | 'gotOpts'
      | 'headers'
      | 'mutool'
      | 'pandoc'
      | 'puppeteerOpts'
      | 'rewriteUrls'
      | 'rewriteHtml'
    > {
    toEncode: (content: Uint8Array, contentType?: string) => string | Promise<string>
  }

  interface PdfMeta {
    title?: string | null
    author?: string | null
    authors?: string | null
    description?: string | null
    publisher?: string | null
    date?: string | null
    lang?: string | null
    image?: string | null
    logo?: string | null
  }

  /**
   * Check if a URL should use 'fetch' mode (no prerender needed)
   */
  function isFetchMode(url: string): boolean

  /**
   * Get content directly with a specific mode
   */
  function getContent(
    url: string,
    mode: 'fetch' | 'prerender',
    options: GetContentOptions
  ): PCancelable<HtmlGetContent>

  /**
   * Default mutool function (returns undefined if mutool is not installed)
   */
  function defaultMutool(): Mutool | undefined

  /**
   * Default pandoc function (returns undefined if pandoc is not installed)
   */
  function defaultPandoc(): Pandoc | undefined

  /**
   * Path of the pandoc binary, or undefined if pandoc is not installed
   */
  function getPandocPath(): string | undefined

  /**
   * Path of the mutool binary, or undefined if mutool is not installed
   */
  function getMutoolPath(): string | undefined

  /**
   * Default request timeout in milliseconds
   */
  const REQ_TIMEOUT: number

  /**
   * Default abort types for prerendering
   */
  const ABORT_TYPES: string[]

  /**
   * PDF size threshold in bytes (150KB)
   */
  const PDF_SIZE_TRESHOLD: number

  /** Read title, author, date, and the rest from PDF bytes. */
  function extractPdf(input: {
    url: string
    pdf: ArrayBuffer | ArrayBufferView
    maxPages?: number
  }): Promise<PdfMeta>

  /** `extractPdf` that returns undefined on a non-PDF or a parse error. */
  function extractPdfSafe(
    input: ArrayBuffer | ArrayBufferView,
    url: string,
    opts?: { maxPages?: number }
  ): Promise<PdfMeta | undefined>

  /** `true` when the bytes start with `%PDF` (junk before the header is allowed). */
  function isPdf(input: ArrayBuffer | ArrayBufferView): boolean

  /** `true` when `url` looks like a PDF link. */
  function isPdfLink(url?: string): boolean

  /** Empty HTML document with PDF metadata stamped as meta tags. */
  function pdfToHtml(
    input: ArrayBuffer | ArrayBufferView,
    url: string,
    opts?: { maxPages?: number }
  ): Promise<string>
}

/**
 * Main function to get HTML from a URL
 */
declare function htmlGet(
  targetUrl: string,
  options?: htmlGet.HtmlGetOptions
): PCancelable<htmlGet.HtmlGetResult>

export = htmlGet
