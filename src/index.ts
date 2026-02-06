/**
 * clawrouter-openrouter
 *
 * Smart LLM router for OpenClaw via OpenRouter — 20+ models, intelligent routing, cost savings.
 * Routes each request to the cheapest model that can handle it.
 *
 * Usage:
 *   # Install the plugin
 *   openclaw plugin install clawrouter-openrouter
 *
 *   # Set your OpenRouter API key
 *   export OPENROUTER_API_KEY=sk-or-...
 *
 *   # Use smart routing (auto-picks cheapest model)
 *   openclaw models set clawrouter/auto
 *
 *   # Or use any specific model
 *   openclaw models set openai/gpt-5.2
 */

import type { OpenClawPluginDefinition, OpenClawPluginApi } from "./types.js";
import { openrouterProvider, setActiveProxy } from "./provider.js";
import { startProxy } from "./proxy.js";
import { resolveApiKey } from "./auth.js";
import type { RoutingConfig } from "./router/index.js";
import { OPENCLAW_MODELS } from "./models.js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Inject OpenRouter models config into OpenClaw config file.
 * This is required because registerProvider() alone doesn't make models available.
 */
function injectModelsConfig(logger: { info: (msg: string) => void }): void {
  const configPath = join(homedir(), ".openclaw", "openclaw.json");
  if (!existsSync(configPath)) {
    logger.info("OpenClaw config not found, skipping models injection");
    return;
  }

  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8"));

    // Check if already configured
    if (config.models?.providers?.openrouter) {
      return; // Already configured
    }

    // Inject models config
    if (!config.models) config.models = {};
    if (!config.models.providers) config.models.providers = {};

    config.models.providers.openrouter = {
      baseUrl: "http://127.0.0.1:8402/v1",
      api: "openai-completions",
      models: OPENCLAW_MODELS,
    };

    writeFileSync(configPath, JSON.stringify(config, null, 2));
    logger.info("Injected OpenRouter models into OpenClaw config");
  } catch {
    // Silently fail -- config injection is best-effort
  }
}

/**
 * Start the proxy in the background.
 * Called from register() because OpenClaw's loader only invokes register(),
 * treating activate() as an alias (def.register ?? def.activate).
 */
async function startProxyInBackground(api: OpenClawPluginApi): Promise<void> {
  // Resolve API key from env var or plugin config
  const apiKey = resolveApiKey(api.pluginConfig);
  api.logger.info("OpenRouter API key configured");

  // Resolve routing config overrides from plugin config
  const routingConfig = api.pluginConfig?.routing as Partial<RoutingConfig> | undefined;

  const proxy = await startProxy({
    apiKey,
    routingConfig,
    onReady: (port) => {
      api.logger.info(`OpenRouter proxy listening on port ${port}`);
    },
    onError: (error) => {
      api.logger.error(`OpenRouter proxy error: ${error.message}`);
    },
    onRouted: (decision) => {
      const cost = decision.costEstimate.toFixed(4);
      const saved = (decision.savings * 100).toFixed(0);
      api.logger.info(`${decision.model} $${cost} (saved ${saved}%)`);
    },
  });

  setActiveProxy(proxy);
  api.logger.info(`OpenRouter provider active — ${proxy.baseUrl}/v1 (smart routing enabled)`);
}

const plugin: OpenClawPluginDefinition = {
  id: "clawrouter",
  name: "ClawRouter",
  description: "Smart LLM router for OpenRouter — 20+ models, intelligent routing, cost savings",
  version: "0.4.0",

  register(api: OpenClawPluginApi) {
    // Register OpenRouter as a provider (sync -- available immediately)
    api.registerProvider(openrouterProvider);

    // Inject models config into OpenClaw config file
    // This persists the config so models are recognized on restart
    injectModelsConfig(api.logger);

    // Also set runtime config for immediate availability
    if (!api.config.models) {
      api.config.models = { providers: {} };
    }
    if (!api.config.models.providers) {
      api.config.models.providers = {};
    }
    api.config.models.providers.openrouter = {
      baseUrl: "http://127.0.0.1:8402/v1",
      api: "openai-completions",
      models: OPENCLAW_MODELS,
    };

    api.logger.info("OpenRouter provider registered (20+ models via smart routing)");

    // Start proxy in background (fire-and-forget)
    // OpenClaw only calls register(), not activate() -- so all init goes here.
    // The loader ignores async returns, but the proxy starts in the background
    // and setActiveProxy() makes it available to the provider once ready.
    startProxyInBackground(api).catch((err) => {
      api.logger.error(
        `Failed to start OpenRouter proxy: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  },
};

export default plugin;

// Re-export for programmatic use
export { startProxy } from "./proxy.js";
export type { ProxyOptions, ProxyHandle } from "./proxy.js";
export { openrouterProvider } from "./provider.js";
export { OPENCLAW_MODELS, ROUTER_MODELS, buildProviderModels } from "./models.js";
export type { RouterModel } from "./models.js";
export { route, DEFAULT_ROUTING_CONFIG } from "./router/index.js";
export type { RoutingDecision, RoutingConfig, Tier } from "./router/index.js";
export { logUsage } from "./logger.js";
export type { UsageEntry } from "./logger.js";
export { RequestDeduplicator } from "./dedup.js";
export type { CachedResponse } from "./dedup.js";
export { ApiKeyError, isApiKeyError } from "./errors.js";
export { resolveApiKey } from "./auth.js";
export { fetchWithRetry, isRetryable, DEFAULT_RETRY_CONFIG } from "./retry.js";
export type { RetryConfig } from "./retry.js";
