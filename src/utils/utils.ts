import { Logger, ScrapProcess } from '../logger/types'
import { AISupportedLanguage } from '../scraper/types'

import chalk from 'chalk'
import { BoundingBox, ElementHandle, Page } from 'puppeteer'

/**
 * Extracts the hostname from a URL.
 * @param url URL
 * @returns the hostname
 */
export const getHostname = (url: string) => {
  return new URL(url).hostname
}

/**
 * Attend un certain temps avant de continuer l'exécution du programme.
 * @param ms le temps d'attente en millisecondes
 */
export async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Permet de cocher/décocher une checkbox en fonction de son label sur LinkedIn
 * @param page la page Puppeteer sur laquelle effectuer l'action
 * @param label le texte du label de la checkbox à cocher/décocher
 */
export async function clickOnLinkedInCheckboxByLabel(page: Page, labelText: string) {
  const hasFound = await page.evaluate(labelText => {
    // on cherche la section "Lieu"
    const sections = Array.from(document.getElementsByClassName('search-reusables__secondary-filters-filter'))
    let lieuSection
    for (const section of sections) {
      const sectionName = section.querySelector('h3.text-heading-large')
      if (sectionName?.textContent?.trim().replace(/\s+/g, ' ').toLowerCase() === 'lieu') {
        lieuSection = section
        break
      }
    }

    if (!lieuSection) {
      throw new Error('Cannot find section named "Lieu"')
    }

    const labels: HTMLLabelElement[] = Array.from(lieuSection.querySelectorAll('label'))
    const label = labels.find(label =>
      Array.from(label.childNodes).some(e => e.textContent?.replace(/\s+/g, ' ').trim().includes(labelText)),
    )

    if (label) {
      const inputId = label.getAttribute('for')
      if (inputId) {
        const input = document.getElementById(inputId)
        if (input) {
          input.click()
          return true
        }
      } else {
        const input: HTMLInputElement | null =
          label.querySelector('input') || (label.nextElementSibling as HTMLInputElement)
        if (input && input.tagName === 'INPUT') {
          input.click()
          return true
        }
      }
    }

    return false
  }, labelText) // faut le passer en paramètre de la fonction evaluate pour qu'il soit dispo dans le DOM au runtime

  if (!hasFound) {
    console.log(chalk.red(`Impossible de trouver la checkbox avec le label ${labelText}`))
  }
}

/**
 * Permet de cocher/décocher une checkbox en fonction de son label, sur CoordinationSud
 * @param page la page Puppeteer sur laquelle effectuer l'action
 * @param label le texte du label de la checkbox à cocher/décocher
 */
export async function coordinationSud_clickOnCheckboxByLabel(page: Page, labelText: string) {
  await page.evaluate(labelText => {
    const divs: HTMLLabelElement[] = Array.from(
      document.getElementsByClassName('search-filters')[0].querySelectorAll('.facetwp-checkbox'),
    )
    const div = divs.find(d =>
      Array.from(d.childNodes).some(e => e.textContent?.replace(/\s+/g, ' ').trim().includes(labelText)),
    )

    div?.click()
  }, labelText) // faut le passer en paramètre de la fonction evaluate pour qu'il soit dispo dans le DOM au runtime
}

/**
 * Permet de vider tout le contenu d'un input
 * @param page la page qui contient l'input
 * @param selector le sélecteur pour récupérer l'input
 */
export async function clearInput(page: Page, selector: string) {
  const input = await page.$(selector)
  if (input) {
    await input.click({ clickCount: 3 }) // on sélectionne tout
    await page.keyboard.press('Backspace')
  }
}

/**
 * Permet de scroller en bas d'un élément jusqu'à ce que la fin de l'élément soit atteinte
 * @param page la page contenant l'élément
 * @param selector l'élément à scroller
 */
export async function scrollToBottom(page: Page, selector: string): Promise<boolean> {
  const sectionToScroll = await page.waitForSelector(selector)
  if (sectionToScroll) {
    const maxScrolls = 10
    const delayBetweenScrollsMills = 200 // on donne le temps à la page de charger les nouveaux éléments

    /**
     * On récupère la bounding box de l'élément à scroller pour pouvoir scroller dessus. Celle-ci n'est récupérée
     * qu'une seule fois, car elle ne change pas après le scroll et cela me permet d'éviter de devoir prendre en
     * considération le déplacement de l'élément après chaque scroll.
     */
    const boundingBox = await getBoundingBox(sectionToScroll)

    for (let i = 0; i < maxScrolls; i++) {
      scrollDown(page, boundingBox)
      await wait(delayBetweenScrollsMills)
    }

    return true
  } else {
    return false
  }
}

/**
 * Get the bounding box for the element to be scrolled.
 * @param elementHandle
 * @returns
 */
async function getBoundingBox(elementHandle: ElementHandle): Promise<BoundingBox> {
  const boundingBox = await elementHandle.boundingBox()
  if (boundingBox) {
    return boundingBox
  } else {
    throw new Error('Failed to find bounding box for provided element')
  }
}

/**
 * Permet de scroller vers le bas une page Puppet, en plaçant la souris au tout début de l'élément à scroller pour que le scroll soit effectif
 * @param page la page où se trouve l'élement
 * @param boundingBox la bounding box de l'élement à scroller
 */
async function scrollDown(page: Page, boundingBox: BoundingBox): Promise<void> {
  page.mouse.move(boundingBox.x + 2, boundingBox.y + 2)
  await page.mouse.wheel({ deltaY: 300 })
}

/**
 * Génère la question à envoyer à OpenAI pour optimiser une recherche de poste en déterminant si le nom d'une annonce vaut le coup.
 * Cette question s'adapte selon la langue passée en paramètre.
 * @param idealJobDescription la description idéal du poste
 * @param jobNames tous les noms de postes à inclure dans la question
 * @param language la langue de la question
 */
export function generateAIQuestion_jobName(
  idealJobDescription: string,
  jobNames: string[],
  language: AISupportedLanguage,
) {
  const part1 = language === 'fr' ? 'Description de mon travail idéal' : 'Description of my ideal job'
  const part2 =
    language === 'fr'
      ? "Je vais t'envoyer une liste de noms d'offres d'emploi. Pour chacun de ces noms et uniquement eux, en respectant leur ordre, dis-moi si tu penses que l'offre me correspond en répondant uniquement par 1 pour oui, -1 pour non et 0 pour ne sait pas."
      : "I am going to send you a job opportunities name list. For each of them and strictly them, respecting their order, tell me if you think the offer corresponds to me by answering only with 1 for yes, -1 for no and 0 for don't know."
  const part3 =
    language === 'fr'
      ? 'Voici la liste, dont chaque valeur est contenue entre guillemets et toutes les valeurs sont séparées par une virgule'
      : "Here's the list, in which items are enclosed by quotes and separated by a comma"

  const question = `${part1}: "${idealJobDescription}".\n${part2}. ${part3}:\n${jobNames.map(n => `"${n}"`).join(',')}`

  return question
}

/**
 * Génère la question à envoyer à OpenAI pour optimiser une recherche de poste en déterminant si une annonce vaut le coup en fonction de sa description.
 * Cette question s'adapte selon la langue passée en paramètre.
 * @param idealJobDescription la description idéal du poste
 * @param jobDescription la description du poste
 * @param language la langue de la question
 */
export function generateAIQuestion_jobDescription(
  idealJobDescription: string,
  description: string,
  language: AISupportedLanguage,
) {
  const part1 = language === 'fr' ? 'Description de mon travail idéal' : 'Description of my ideal job'
  const part2 =
    language === 'fr'
      ? "En répondant uniquement par 1 pour oui ou -1 pour non, dis-moi si la description d'un poste suivante me correspond:"
      : 'By answering only with either 1 for yes or -1 for no, tell me if the following job description fits me:'

  const question = `${part1}: "${idealJobDescription}".\n${part2}: "${description.trim().replace(/\s+/g, ' ')}".`

  return question
}

/**
 * Permet de cliquer sur le bouton de la page suivante sur LinkedIn. Il existe plusieurs manière de passer à la page suivante, et j'ai l'impression
 * que LinkedIn change régulièrement son DOM, donc cette fonction va tenter plusieurs approches.
 * @param page la page Puppeteer sur laquelle effectuer l'action
 * @param method le numéro de la méthode à utiliser pour passer à la page suivante. Cela permet de ne pas avoir à se retaper les méthodes précédentes à la prochaine exécution.
 * @returns un objet contenant un booléen indiquant si la dernière page a été atteinte et le numéro de la méthode qui a fonctionné
 */
export async function clickOnNextPageButton(
  page: Page,
  method: number,
  logger: Logger,
): Promise<{ hasHitLastPage: boolean; methodThatWorked: number }> {
  let retval = { hasHitLastPage: false, methodThatWorked: method }
  let currentMethod = method

  // méthode 1: cliquer sur un bouton dédié
  if (currentMethod === 1) {
    logger.log(ScrapProcess.RUN, 'Next page button: trying method 1.')
    try {
      await page.waitForSelector('.jobs-search-pagination__button--next')
      const nextButton = await page.$('.jobs-search-pagination__button--next')
      if (nextButton) {
        await nextButton.click()
      } else {
        retval.hasHitLastPage = true
      }

      return retval
    } catch (e: any) {
      logger.log(ScrapProcess.RUN, e.message, { error: true })
      logger.log(ScrapProcess.RUN, 'Next page button: method 1 did not work.')
      currentMethod++
    }
  }

  // méthode 2: cliquer sur le bouton suivant dans la liste des pages (représentée par un nombre)
  if (currentMethod === 2) {
    logger.log(ScrapProcess.RUN, 'Next page button: trying method 2.')
    try {
      await page.waitForSelector('.jobs-search-results-list__pagination')
      const hasHitLastPage = await page.$$eval('.jobs-search-results-list__pagination ul li', pageNumbers => {
        for (let i = 0; i < pageNumbers.length; i++) {
          if (pageNumbers[i].className.includes('selected')) {
            const nextButton: HTMLButtonElement | null = pageNumbers[i + 1]?.querySelector('button')
            if (nextButton) {
              nextButton.click()
              return false
            } else {
              return true
            }
          }
        }

        return false
      })

      retval.hasHitLastPage = hasHitLastPage
      retval.methodThatWorked = 2

      return retval
    } catch (e: any) {
      logger.log(ScrapProcess.RUN, e.message, { error: true })
      return { hasHitLastPage: true, methodThatWorked: 2 }
    }
  }

  throw new Error('No method worked to click on the next page button')
}
