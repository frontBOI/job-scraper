import { BasicLogger } from '../logger/logger'
import { Logger, ScrapProcess } from '../logger/types'
import { OpenAIWizard } from '../openai/OpenAIWizard'
import { getHostname } from '../utils/utils'
import blockedHostsList from './blocked-hosts'
import UserOptionsSchema from './schemas'
import { CreatePageOptions, ScraperOptions, ScraperUserDefinedOptions } from './types'

import puppeteer, { Browser, Page } from 'puppeteer'
import treeKill from 'tree-kill'

/**
 * Generic scraper class that is meant to be extended by other scrapers.
 */
export default abstract class Scraper {
  protected options: ScraperOptions = {
    timeout: 10000,
    headless: true,
    userCookies: [],
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  }

  protected logger: Logger
  protected browser: Browser | null = null
  protected aiWizard: OpenAIWizard | null = null

  constructor(options: ScraperUserDefinedOptions) {
    this.options = Object.assign(this.options, UserOptionsSchema.parse(options))

    this.logger = new BasicLogger({
      onLoggedMessage: this.options.onLoggedMessage,
    })

    // setting up ✨ AI ✨
    if (!this.options.optimizeWithAI) {
      this.logger.log(ScrapProcess.SETUP, 'Skipping AI filtering')
    } else {
      this.aiWizard = new OpenAIWizard({
        apiKey: this.options.optimizeWithAI.apiKey,
        model: this.options.optimizeWithAI.model,
      })
    }
  }

  /**
   * Method to load Puppeteer in memory so we can re-use the browser instance.
   */
  protected async setup() {
    try {
      this.logger.log(
        ScrapProcess.SETUP,
        `Launching puppeteer in the ${this.options.headless ? 'background' : 'foreground'}...`,
      )

      this.browser = await puppeteer.launch({
        headless: this.options.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          "--proxy-server='direct://",
          '--proxy-bypass-list=*',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-features=site-per-process',
          '--enable-features=NetworkService',
          '--allow-running-insecure-content',
          '--enable-automation',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-web-security',
          '--autoplay-policy=user-gesture-required',
          '--disable-background-networking',
          '--disable-breakpad',
          '--disable-client-side-phishing-detection',
          '--disable-component-update',
          '--disable-default-apps',
          '--disable-domain-reliability',
          '--disable-extensions',
          '--disable-features=AudioServiceOutOfProcess',
          '--disable-hang-monitor',
          '--disable-ipc-flooding-protection',
          '--disable-notifications',
          '--disable-offer-store-unmasked-wallet-cards',
          '--disable-popup-blocking',
          '--disable-print-preview',
          '--disable-prompt-on-repost',
          '--disable-speech-api',
          '--disable-sync',
          '--disk-cache-size=33554432',
          '--hide-scrollbars',
          '--ignore-gpu-blacklist',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-default-browser-check',
          '--no-first-run',
          '--no-pings',
          '--no-zygote',
          '--password-store=basic',
          '--use-gl=swiftshader',
          '--use-mock-keychain',
        ],
        timeout: this.options.timeout,
      })

      this.logger.log(ScrapProcess.SETUP, 'Puppeteer launched!')
    } catch (err: any) {
      this.logger.log(ScrapProcess.SETUP, `An error occurred during setup: ${err.message}`, { error: true })
      await this.close() // Kill Puppeteer
    }
  }

  /**
   * Create a Puppeteer page with some extra settings to speed up the crawling process.
   */
  protected async createPage(options?: CreatePageOptions): Promise<Page> {
    const defaultOptions: CreatePageOptions = {
      preservePreviousPage: false,
    }

    options = Object.assign(defaultOptions, options)

    if (!this.browser) {
      throw new Error('Browser not set.')
    }

    // Important: Do not block "stylesheet", makes the crawler not work for LinkedIn
    const blockedResources = ['image', 'media', 'font', 'texttrack', 'object', 'beacon', 'csp_report', 'imageset']

    try {
      const page = await this.browser.newPage()

      // Use already open page
      // This makes sure we don't have an extra open tab consuming memory
      if (!options.preservePreviousPage) {
        const firstPage = (await this.browser.pages())[0]
        await firstPage.close()
      }

      // A list of hostnames that are trackers
      // By blocking those requests we can speed up the crawling
      // This is kinda what a normal adblocker does, but really simple
      const blockedHosts = this.getBlockedHosts()
      const blockedResourcesByHost = ['script', 'xhr', 'fetch', 'document']

      // Block loading of resources, like images and css, we dont need that
      await page.setRequestInterception(true)

      page.on('request', req => {
        if (blockedResources.includes(req.resourceType())) {
          return req.abort()
        }

        const hostname = getHostname(req.url())

        // Block all script requests from certain host names
        if (blockedResourcesByHost.includes(req.resourceType()) && hostname && blockedHosts[hostname] === true) {
          return req.abort()
        }

        return req.continue()
      })

      await page.setUserAgent(this.options.userAgent)

      await page.setViewport({
        width: 1200,
        height: 720,
      })

      for (const cookie of this.options.userCookies) {
        await page.setCookie({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
        })
      }

      return page
    } catch (err: any) {
      this.logger.log(ScrapProcess.SETUP, `An error occurred during page setup: ${err.message}`, { error: true })
      await this.close() // Kill Puppeteer
      throw err
    }
  }

  /**
   * Method to block know hosts that have some kind of tracking.
   * By blocking those hosts we speed up the crawling.
   *
   * More info: http://winhelp2002.mvps.org/hosts.htm
   */
  private getBlockedHosts(): Record<string, boolean> {
    const blockedHostsArray = blockedHostsList.split('\n')

    let blockedHostsObject = blockedHostsArray.reduce(
      (prev, curr) => {
        const frags = curr.split(' ')

        if (frags.length > 1 && frags[0] === '0.0.0.0') {
          prev[frags[1].trim()] = true
        }

        return prev
      },
      {} as Record<string, boolean>,
    )

    blockedHostsObject = {
      ...blockedHostsObject,
      'static.chartbeat.com': true,
      'scdn.cxense.com': true,
      'api.cxense.com': true,
      'www.googletagmanager.com': true,
      'connect.facebook.net': true,
      'platform.twitter.com': true,
      'tags.tiqcdn.com': true,
      'dev.visualwebsiteoptimizer.com': true,
      'smartlock.google.com': true,
      'cdn.embedly.com': true,
    }

    return blockedHostsObject
  }

  /**
   * Method to complete kill any Puppeteer process still active.
   * Freeing up memory.
   */
  public async close(page?: Page): Promise<void> {
    if (page) {
      this.logger.log(ScrapProcess.CLOSING, 'Closing page...')
      await page.close()
      this.logger.log(ScrapProcess.CLOSING, 'Page closed.')
    }

    if (this.browser) {
      this.logger.log(ScrapProcess.CLOSING, 'Closing browser...')
      await this.browser.close()
      this.logger.log(ScrapProcess.CLOSING, 'Browser closed.')

      const browserProcessPid = this.browser.process()?.pid

      // Completely kill the browser process to prevent zombie processes
      // https://docs.browserless.io/blog/2019/03/13/more-observations.html#tip-2-when-you-re-done-kill-it-with-fire
      if (browserProcessPid) {
        this.logger.log(ScrapProcess.CLOSING, `Killing browser process pid: ${browserProcessPid}...`)

        treeKill(browserProcessPid, 'SIGKILL', err => {
          if (err) {
            throw new Error(`Failed to kill browser process pid: ${browserProcessPid} (${err.message})`)
          }

          this.logger.log(ScrapProcess.CLOSING, `Killed browser pid: ${browserProcessPid}. Closed browser.`)
          return
        })
      }
    }

    return
  }

  /**
   * Method to be overloaded
   */
  public async run(): Promise<any> {
    this.logger.log(ScrapProcess.RUN, 'Running has not been implemented yet.')
  }
}
