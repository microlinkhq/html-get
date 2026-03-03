import type { CheerioAPI } from 'cheerio'

/**
 * Result returned by html-get
 */
export interface HtmlGetResult {
  /** The HTML content */
  html: string
  /** Response headers */
  headers: Record<string, string | string[] | undefined>
  /** Final URL after redirects */
  url: string
  /** HTTP status code */
  statusCode: number
  /** Redirect history */
  redirects: Array<{ statusCode: number; url: string }>
  /** Mode used: 'fetch' or 'prerender' */
  mode: 'fetch' | 'prerender'
  /** Parsed HTML (Cheerio) */
  $?: CheerioAPI
  /** Statistics about the request */
  stats: {
    mode: 'fetch' | 'prerender'
    timing: number
  }
}

/**
 * Options for html-get
 */
export interface HtmlGetOptions {
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
  mutool?: ((...args: string[]) => any) | false
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

/**
 * Main function to get HTML from a URL
 */
export function htmlGet(
  targetUrl: string,
  options?: HtmlGetOptions
): Promise<HtmlGetResult>

/**
 * Check if a URL should use 'fetch' mode (no prerender needed)
 */
export function isFetchMode(url: string): boolean

/**
 * Get content directly with a specific mode
 */
export function getContent(
  url: string,
  mode: 'fetch' | 'prerender',
  options?: HtmlGetOptions
): Promise<HtmlGetResult>

/**
 * Default mutool function (returns undefined if mutool is not installed)
 */
export function defaultMutool(): ((...args: string[]) => any) | undefined

/**
 * Default request timeout in milliseconds
 */
export const REQ_TIMEOUT: number

/**
 * Default abort types for prerendering
 */
export const ABORT_TYPES: string[]

/**
 * PDF size threshold in bytes (150KB)
 */
export const PDF_SIZE_TRESHOLD: number

export default htmlGet
