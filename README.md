<div align='center'>
    <img src="doc/gif.webp" height="256">
    <h1 align='center'>Job scraper 🕵🏻‍♂️</h1>
</div>

<div align="center">
    <img src=https://img.shields.io/badge/Created_by-Tom_Blanchet-blue?color=FED205&style=for-the-badge>
    <img src=https://img.shields.io/badge/Maintained%20%3F-yes-green.svg?style=for-the-badge>
</div>
 
<div align="center">
    <img src=https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white>
</div>
 
<div align="center">
    <a href='https://www.google.com/url?sa=t&rct=j&q=&esrc=s&source=web&cd=&cad=rja&uact=8&ved=2ahUKEwiFmq2GueKEAxXf_7sIHcONCvcQFnoECBEQAQ&url=https%3A%2F%2Ffr.linkedin.com%2Fin%2Ftom-blanchet&usg=AOvVaw2NyolXUeo7ja8PpF4VNmHt&opi=89978449'>
    <img src=https://img.shields.io/badge/Maintenu_par_Tom_Blanchet-0077B5?logo=linkedin&logoColor=white&style=for-the-badge>
    </a>
</div>

> Scrape the web to find job offers that suits you, with the help of ✨ AI ✨

# Install

```bash
npm install @frontboi/job-scraper
```

# Features

This package scrapes multiple websites to help you find your next job, on a quest to find the job that best fits you.

### Traditional scraping

The scraping method is classic:

1. Website crawling: finds, via different hard coded methods, lists of job opportunities.
2. Filtering: by analyzing the opportunity's name, the algorithm decides whether the job fits your needs or not. In this stage, ✨ AI ✨ can be activated to better filter.
3. Scraping: the jobs that passed filtering are now scraped to gather more information. During this stage, if enabled, ✨ AI ✨ can read the job's description, which might result in a rejection if the job doesn't really fit your ideal job's description.
4. Results: here are your final results. Good luck !

### ✨ AI ✨

To help this package to find the opportunities that best fit you, you can enable its ✨ AI ✨ module so that the opportunities content are analyzed in real time and rejected if necessary, based on a description of your dream job that you will provide as input to this AI module.

### Scraped websites

These are the websites scraped by this bot:

- LinkedIn

# Setup

### OpenAI

To enable this ✨ AI ✨ module, you will need an [OpenAI API](https://openai.com/api/pricing/) key (not free but so cheap).

### LinkedIn

In order for the scraper to be able to crawl LinkedIn's content, you will need to have an account and be connected. Then, you will need to extract the `li_at` cookie's value and provide it to the scraper: this is used to persist the connection and let the bot do its job.

# How to use

Here is how to use this package.

### Scrape LinkedIn

```typescript
import { LinkedInCDIScraper } from '@frontboi/job-scraper'

async function scrapeLinkedIn() {
  const scraper = new LinkedInCDIScraper({
    headless: true, // false if you want to test locally and see what happens
    country: 'France',
    cities: ['Paris'],
    searchText: 'Lawyer',
    sessionCookieValue: `${process.env.LINKEDIN_SESSION_COOKIE_VALUE}`,
    ...(process.env.LINKEDIN_SESSION_COOKIE_VALUE && {
      optimizeUsingOpenAI: {
        language: 'en',
        model: 'gpt-4o-mini',
        apiKey: process.env.LINKEDIN_SESSION_COOKIE_VALUE,
        idealJobDescription:
          "Lawyer to help either women's rights, foreigners' rights, family rights or children's rights. I'm not interested in any job other than a social cause.",
      },
    }),
    jobTitleBannedWords: [
      // all the words you want to ban from a job's title
      // eg: "internship", "finance", "market"...
    ],
  })

  // run the scraper
  await scraper.setup()
  const result = await scraper.run()

  console.log(result)
}

scrapeLinkedIn()
```

# Support

You can create an issue on this project and I will gladly consider it.
If you prefer, you can contact me on my Linkedin or directly by email (contact@tomblanchet.fr).

_Tom Blanchet - 2024_
