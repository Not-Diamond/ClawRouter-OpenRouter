/**
 * OpenRouter Auth Methods for OpenClaw
 *
 * Provides API key-based authentication for the OpenRouter provider.
 * Operators configure their OpenRouter API key, which is sent as a
 * Bearer token with each LLM request.
 *
 * Two methods:
 *   1. Environment variable — read from OPENROUTER_API_KEY
 *   2. Manual input — operator enters API key via wizard
 */

import type { ProviderAuthMethod, ProviderAuthContext, ProviderAuthResult } from "./types.js";

/**
 * Resolve OpenRouter API key from environment variable or plugin config.
 */
export function resolveApiKey(pluginConfig?: Record<string, unknown>): string {
  // 1. Environment variable (highest priority)
  const envKey = process.env.OPENROUTER_API_KEY;
  if (typeof envKey === "string" && envKey.trim().length > 0) {
    return envKey.trim();
  }

  // 2. Plugin config
  const configKey = pluginConfig?.apiKey;
  if (typeof configKey === "string" && configKey.trim().length > 0) {
    return configKey.trim();
  }

  throw new Error(
    "OpenRouter API key not found. Set the OPENROUTER_API_KEY environment variable " +
      "or configure apiKey in the plugin config. " +
      "Get your key at https://openrouter.ai/keys",
  );
}

/**
 * Auth method: operator enters their OpenRouter API key directly.
 */
export const apiKeyAuth: ProviderAuthMethod = {
  id: "api-key",
  label: "OpenRouter API Key",
  hint: "Enter your OpenRouter API key (sk-or-...)",
  kind: "api_key",
  run: async (ctx: ProviderAuthContext): Promise<ProviderAuthResult> => {
    const key = await ctx.prompter.text({
      message: "Enter your OpenRouter API key (sk-or-...)",
      validate: (value: string) => {
        const trimmed = value.trim();
        if (trimmed.length === 0) return "API key is required";
        return undefined;
      },
    });

    if (!key || typeof key !== "string") {
      throw new Error("OpenRouter API key is required");
    }

    return {
      profiles: [
        {
          profileId: "default",
          credential: { apiKey: key.trim() },
        },
      ],
      notes: [
        "OpenRouter API key stored securely in OpenClaw credentials.",
        "Get your key at https://openrouter.ai/keys",
      ],
    };
  },
};

/**
 * Auth method: read API key from OPENROUTER_API_KEY environment variable.
 */
export const envKeyAuth: ProviderAuthMethod = {
  id: "env-key",
  label: "Environment Variable",
  hint: "Use OPENROUTER_API_KEY environment variable",
  kind: "api_key",
  run: async (): Promise<ProviderAuthResult> => {
    const key = process.env.OPENROUTER_API_KEY;

    if (!key) {
      throw new Error(
        "OPENROUTER_API_KEY environment variable is not set. " +
          "Get your key at https://openrouter.ai/keys",
      );
    }

    return {
      profiles: [
        {
          profileId: "default",
          credential: { apiKey: key.trim() },
        },
      ],
      notes: ["Using API key from OPENROUTER_API_KEY environment variable."],
    };
  },
};
