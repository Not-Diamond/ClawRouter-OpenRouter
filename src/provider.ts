/**
 * OpenRouter ProviderPlugin for OpenClaw
 *
 * Registers OpenRouter as an LLM provider in OpenClaw.
 * Uses a local proxy to handle smart routing transparently --
 * pi-ai sees a standard OpenAI-compatible API at localhost.
 */

import type { ProviderPlugin, AuthProfileCredential } from "./types.js";
import { apiKeyAuth, envKeyAuth } from "./auth.js";
import { buildProviderModels } from "./models.js";
import type { ProxyHandle } from "./proxy.js";

/**
 * State for the running proxy (set when the plugin activates).
 */
let activeProxy: ProxyHandle | null = null;

/**
 * Update the proxy handle (called from index.ts when the proxy starts).
 */
export function setActiveProxy(proxy: ProxyHandle): void {
  activeProxy = proxy;
}

export function getActiveProxy(): ProxyHandle | null {
  return activeProxy;
}

/**
 * OpenRouter provider plugin definition.
 */
export const openrouterProvider: ProviderPlugin = {
  id: "openrouter",
  label: "OpenRouter",
  docsPath: "https://openrouter.ai/docs",
  aliases: ["or"],
  envVars: ["OPENROUTER_API_KEY"],

  // Model definitions -- dynamically set to proxy URL
  get models() {
    if (!activeProxy) {
      // Fallback: point to OpenRouter API directly
      // (won't have smart routing, but allows config loading before proxy starts)
      return buildProviderModels("https://openrouter.ai/api");
    }
    return buildProviderModels(activeProxy.baseUrl);
  },

  // Auth methods
  auth: [envKeyAuth, apiKeyAuth],

  // Format the stored credential as the API key
  formatApiKey: (cred: AuthProfileCredential): string => {
    if ("apiKey" in cred && typeof cred.apiKey === "string") {
      return cred.apiKey;
    }
    throw new Error("OpenRouter credential must contain an apiKey");
  },
};
