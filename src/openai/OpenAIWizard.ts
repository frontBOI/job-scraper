import { OpenAIConfiguration } from './types'

import OpenAI from 'openai'

export class OpenAIWizard {
  private instance: OpenAI
  private config: OpenAIConfiguration

  constructor(config: OpenAIConfiguration) {
    this.config = config
    this.instance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }

  /**
   * Envoie une question à OpenAI et récupère la réponse
   * @param string la question à envoyer à OpenAI
   */
  async ask(question: string): Promise<string | null> {
    let answer
    try {
      const response = await this.instance.chat.completions.create({
        messages: [{ role: 'user', content: question }],
        model: this.config.model || 'gpt-4o-mini',
      })

      answer = response.choices[0].message.content
      return answer
    } catch (error) {
      console.error('Error generating text: ', error)
    }

    return null
  }
}
