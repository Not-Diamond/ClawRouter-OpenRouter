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
    contextWindow: 2_000_000,
    maxOutput: 128_000,
  },

  // --- Top models by usage on OpenRouter (ranked by tokens served) ---

  // #1 — Google Gemini 3 Flash Preview
  {
    id: "google/gemini-3-flash-preview",
    name: "Gemini 3 Flash Preview",
    inputPrice: 0.5,
    outputPrice: 3.0,
    contextWindow: 1_048_576,
    maxOutput: 65_535,
    reasoning: true,
    vision: true,
  },

  // #2 — Anthropic Claude Sonnet 4.5
  {
    id: "anthropic/claude-sonnet-4.5",
    name: "Claude Sonnet 4.5",
    inputPrice: 3.0,
    outputPrice: 15.0,
    contextWindow: 1_000_000,
    maxOutput: 64_000,
    reasoning: true,
    vision: true,
  },

  // #3 — Moonshot Kimi K2.5
  {
    id: "moonshotai/kimi-k2.5",
    name: "Kimi K2.5",
    inputPrice: 0.45,
    outputPrice: 2.5,
    contextWindow: 262_144,
    maxOutput: 65_535,
    reasoning: true,
    vision: true,
  },

  // #4 — DeepSeek V3.2
  {
    id: "deepseek/deepseek-v3.2",
    name: "DeepSeek V3.2",
    inputPrice: 0.25,
    outputPrice: 0.38,
    contextWindow: 163_840,
    maxOutput: 65_536,
    reasoning: true,
  },

  // #5 — Google Gemini 2.5 Flash Lite
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    inputPrice: 0.1,
    outputPrice: 0.4,
    contextWindow: 1_048_576,
    maxOutput: 65_535,
    reasoning: true,
    vision: true,
  },

  // #6 — Anthropic Claude Opus 4.6
  {
    id: "anthropic/claude-opus-4.6",
    name: "Claude Opus 4.6",
    inputPrice: 5.0,
    outputPrice: 25.0,
    contextWindow: 200_000,
    maxOutput: 64_000,
    reasoning: true,
    vision: true,
  },

  // #7 — MiniMax M2.1
  {
    id: "minimax/minimax-m2.1",
    name: "MiniMax M2.1",
    inputPrice: 0.27,
    outputPrice: 0.95,
    contextWindow: 196_608,
    maxOutput: 65_536,
    reasoning: true,
  },

  // #8 — xAI Grok Code Fast 1
  {
    id: "x-ai/grok-code-fast-1",
    name: "Grok Code Fast 1",
    inputPrice: 0.2,
    outputPrice: 1.5,
    contextWindow: 256_000,
    maxOutput: 10_000,
    reasoning: true,
  },

  // #9 — xAI Grok 4.1 Fast
  {
    id: "x-ai/grok-4.1-fast",
    name: "Grok 4.1 Fast",
    inputPrice: 0.2,
    outputPrice: 0.5,
    contextWindow: 2_000_000,
    maxOutput: 30_000,
    reasoning: true,
    vision: true,
  },

  // #10 — Arcee AI Trinity Large Preview (free)
  {
    id: "arcee-ai/trinity-large-preview:free",
    name: "Trinity Large Preview (free)",
    inputPrice: 0,
    outputPrice: 0,
    contextWindow: 131_000,
    maxOutput: 65_536,
  },

  // #11 — OpenAI GPT-5 Nano
  {
    id: "openai/gpt-5-nano",
    name: "GPT-5 Nano",
    inputPrice: 0.05,
    outputPrice: 0.4,
    contextWindow: 400_000,
    maxOutput: 128_000,
    reasoning: true,
    vision: true,
  },

  // #12 — Z.AI GLM 4.7
  {
    id: "z-ai/glm-4.7",
    name: "GLM 4.7",
    inputPrice: 0.4,
    outputPrice: 1.5,
    contextWindow: 202_752,
    maxOutput: 65_535,
    reasoning: true,
  },

  // #13 — Google Gemini 3 Pro Preview
  {
    id: "google/gemini-3-pro-preview",
    name: "Gemini 3 Pro Preview",
    inputPrice: 2.0,
    outputPrice: 12.0,
    contextWindow: 1_048_576,
    maxOutput: 65_536,
    reasoning: true,
    vision: true,
  },

  // #14 — xAI Grok 4 Fast
  {
    id: "x-ai/grok-4-fast",
    name: "Grok 4 Fast",
    inputPrice: 0.2,
    outputPrice: 0.5,
    contextWindow: 2_000_000,
    maxOutput: 30_000,
    reasoning: true,
    vision: true,
  },

  // #15 — OpenAI GPT-5.2
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
