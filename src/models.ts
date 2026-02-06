/**
 * OpenRouter Model Definitions for OpenClaw
 *
 * Maps OpenRouter's AI models to OpenClaw's ModelDefinitionConfig format.
 * All models use the "openai-completions" API since OpenRouter is OpenAI-compatible.
 *
 * Pricing is in USD per 1M tokens (sourced from OpenRouter's /api/v1/models endpoint).
 */

import type { ModelDefinitionConfig, ModelProviderConfig } from "./types.js";

export type RouterModel = {
  id: string;
  name: string;
  inputPrice: number;
  outputPrice: number;
  contextWindow: number;
  maxOutput: number;
  reasoning?: boolean;
  vision?: boolean;
};

export const ROUTER_MODELS: RouterModel[] = [
  // Smart routing meta-model -- proxy replaces with actual model
  {
    id: "clawrouter/auto",
    name: "ClawRouter Smart Router",
    inputPrice: 0,
    outputPrice: 0,
    contextWindow: 1_050_000,
    maxOutput: 128_000,
  },

  // OpenAI GPT-5 Family
  {
    id: "openai/gpt-5.2",
    name: "GPT-5.2",
    inputPrice: 1.75,
    outputPrice: 14.0,
    contextWindow: 400_000,
    maxOutput: 128_000,
    reasoning: true,
    vision: true,
  },
  {
    id: "openai/gpt-5.2-pro",
    name: "GPT-5.2 Pro",
    inputPrice: 21.0,
    outputPrice: 168.0,
    contextWindow: 400_000,
    maxOutput: 128_000,
    reasoning: true,
  },
  {
    id: "openai/gpt-5.2-codex",
    name: "GPT-5.2 Codex",
    inputPrice: 1.75,
    outputPrice: 14.0,
    contextWindow: 400_000,
    maxOutput: 128_000,
    reasoning: true,
  },
  {
    id: "openai/gpt-5.1",
    name: "GPT-5.1",
    inputPrice: 1.25,
    outputPrice: 10.0,
    contextWindow: 400_000,
    maxOutput: 128_000,
    reasoning: true,
  },
  {
    id: "openai/gpt-5.1-codex-mini",
    name: "GPT-5.1 Codex Mini",
    inputPrice: 0.25,
    outputPrice: 2.0,
    contextWindow: 200_000,
    maxOutput: 65_536,
  },

  // Anthropic
  {
    id: "anthropic/claude-opus-4.6",
    name: "Claude Opus 4.6",
    inputPrice: 5.0,
    outputPrice: 25.0,
    contextWindow: 200_000,
    maxOutput: 32_000,
    reasoning: true,
  },

  // Google Gemini
  {
    id: "google/gemini-3-pro-preview",
    name: "Gemini 3 Pro Preview",
    inputPrice: 2.0,
    outputPrice: 12.0,
    contextWindow: 1_050_000,
    maxOutput: 65_536,
    reasoning: true,
    vision: true,
  },
  {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash Preview",
    inputPrice: 0.5,
    outputPrice: 3.0,
    contextWindow: 1_000_000,
    maxOutput: 65_536,
  },

  // DeepSeek
  {
    id: "deepseek/deepseek-v3.2",
    name: "DeepSeek V3.2",
    inputPrice: 0.25,
    outputPrice: 0.38,
    contextWindow: 128_000,
    maxOutput: 8_192,
  },
  {
    id: "deepseek/deepseek-v3.2-speciale",
    name: "DeepSeek V3.2 Speciale",
    inputPrice: 0.27,
    outputPrice: 0.41,
    contextWindow: 128_000,
    maxOutput: 8_192,
    reasoning: true,
  },

  // Moonshot / Kimi
  {
    id: "moonshotai/kimi-k2.5",
    name: "Kimi K2.5",
    inputPrice: 0.45,
    outputPrice: 2.5,
    contextWindow: 262_144,
    maxOutput: 8_192,
    reasoning: true,
    vision: true,
  },
  {
    id: "moonshotai/kimi-k2-thinking",
    name: "Kimi K2 Thinking",
    inputPrice: 0.4,
    outputPrice: 1.75,
    contextWindow: 262_144,
    maxOutput: 8_192,
    reasoning: true,
  },

  // xAI / Grok
  {
    id: "x-ai/grok-4.1-fast",
    name: "Grok 4.1 Fast",
    inputPrice: 0.2,
    outputPrice: 0.5,
    contextWindow: 131_072,
    maxOutput: 16_384,
    reasoning: true,
  },

  // Mistral
  {
    id: "mistralai/mistral-large-2512",
    name: "Mistral Large",
    inputPrice: 0.5,
    outputPrice: 1.5,
    contextWindow: 128_000,
    maxOutput: 16_384,
    reasoning: true,
  },

  // Amazon
  {
    id: "amazon/nova-premier-v1",
    name: "Amazon Nova Premier",
    inputPrice: 2.5,
    outputPrice: 12.5,
    contextWindow: 128_000,
    maxOutput: 16_384,
    reasoning: true,
  },

  // Writer
  {
    id: "writer/palmyra-x5",
    name: "Palmyra X5",
    inputPrice: 0.6,
    outputPrice: 6.0,
    contextWindow: 128_000,
    maxOutput: 16_384,
  },
];

/**
 * Convert router model definitions to OpenClaw ModelDefinitionConfig format.
 */
function toOpenClawModel(m: RouterModel): ModelDefinitionConfig {
  return {
    id: m.id,
    name: m.name,
    api: "openai-completions",
    reasoning: m.reasoning ?? false,
    input: m.vision ? ["text", "image"] : ["text"],
    cost: {
      input: m.inputPrice,
      output: m.outputPrice,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: m.contextWindow,
    maxTokens: m.maxOutput,
  };
}

/**
 * All router models in OpenClaw format.
 */
export const OPENCLAW_MODELS: ModelDefinitionConfig[] = ROUTER_MODELS.map(toOpenClawModel);

/**
 * Build a ModelProviderConfig for OpenRouter.
 *
 * @param baseUrl - The proxy's local base URL (e.g., "http://127.0.0.1:12345")
 */
export function buildProviderModels(baseUrl: string): ModelProviderConfig {
  return {
    baseUrl: `${baseUrl}/v1`,
    api: "openai-completions",
    models: OPENCLAW_MODELS,
  };
}
