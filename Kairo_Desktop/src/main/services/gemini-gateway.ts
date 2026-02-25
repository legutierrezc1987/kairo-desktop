import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai'
import type { ModelId } from '../../shared/types'

interface GeminiResponse {
  text: string
  tokenCount: {
    prompt: number
    completion: number
    total: number
  }
}

let sdk: GoogleGenerativeAI | null = null
const models: Map<ModelId, GenerativeModel> = new Map()

export function initGeminiGateway(apiKey: string): void {
  sdk = new GoogleGenerativeAI(apiKey)
  const modelIds: ModelId[] = ['gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite']
  for (const modelId of modelIds) {
    models.set(modelId, sdk.getGenerativeModel({ model: modelId }))
  }
}

export function isInitialized(): boolean {
  return sdk !== null
}

function getModel(modelId: ModelId): GenerativeModel {
  const model = models.get(modelId)
  if (!model) {
    throw new Error(`[GeminiGateway] Model "${modelId}" not initialized. Call initGeminiGateway first.`)
  }
  return model
}

export async function generateContent(prompt: string, modelId: ModelId): Promise<GeminiResponse> {
  const model = getModel(modelId)
  const result = await model.generateContent(prompt)
  const response = result.response
  const text = response.text()
  const usage = response.usageMetadata

  return {
    text,
    tokenCount: {
      prompt: usage?.promptTokenCount ?? 0,
      completion: usage?.candidatesTokenCount ?? 0,
      total: usage?.totalTokenCount ?? 0,
    },
  }
}

export async function countTokens(content: string, modelId: ModelId): Promise<number> {
  const model = getModel(modelId)
  const result = await model.countTokens(content)
  return result.totalTokens
}
