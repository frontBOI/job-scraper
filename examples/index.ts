import LinkedInJobScraper from '../src/linkedin/LinkedInJobScraper'

import dotenv from 'dotenv'

dotenv.config()

async function execute() {
  const scraper = new LinkedInJobScraper({
    headless: true,
    country: 'France',
    cities: ['Paris', 'Bordeaux'],
    searchText: 'Juriste droit des femmes',
    sessionCookieValue: `${process.env.LINKEDIN_SESSION_COOKIE_VALUE}`,
    ...(process.env.LINKEDIN_SESSION_COOKIE_VALUE && {
      optimizeUsingOpenAI: {
        language: 'fr',
        model: 'gpt-4o-mini',
        apiKey: process.env.LINKEDIN_SESSION_COOKIE_VALUE,
        idealJobDescription:
          "Juriste pour aider soit les droits des femmes, des étrangers, de la famille ou des enfants. Tout emploi lié à autre chose qu'une cause sociale ne m'intéresse pas.",
      },
    }),
    jobTitleBannedWords: [
      'stage',
      'stagiaire',
      'bénévolat',
      'alternance',
      'CDD',
      'finance',
      'énergie',
      'energie',
      'financier',
      'urbanisme',
      'banque',
      'bancaire',
      'informatique',
      'corporate',
      'contrat',
      'construction',
      'affaire',
      'legs',
      'foncier',
      'locatif',
      'locative',
      'business',
      'immobilier',
      'droit des sociétés',
      'droit des societes',
      'nouvelle fenêtre',
      'assurance',
      'marchés publics',
      'marchés privés',
      'marchés prives',
      'marches prives',
      'marché public',
      'marche public',
      'marché privé',
      'marche privé',
      'sinistrer',
      'hygiène',
      'généraliste',
      'droit du travail',
      'consommation',
    ],
  })

  const result = await scraper.run()
  console.log(result)
}

execute()
