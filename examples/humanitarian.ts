import HumanitarianScraper from '../src/humanitarian/humanitarian-scraper'

import dotenv from 'dotenv'

dotenv.config()

async function execute() {
  const scraper = new HumanitarianScraper({
    headless: false,
  })

  const result = await scraper.run()
  console.log(result)
}

execute()
