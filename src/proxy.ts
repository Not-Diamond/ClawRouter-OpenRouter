/**
 * Local Proxy Server for OpenRouter
 *
 * Sits between OpenClaw's pi-ai (which makes standard OpenAI-format requests)
 * and OpenRouter's API (which requires a Bearer token).
 *
 * Flow:
 *   pi-ai -> http://localhost:{port}/v1/chat/completions
 *        -> proxy forwards to https://openrouter.ai/api/v1/chat/completions
 *        -> with Authorization: Bearer <apiKey>
 *        -> streams response back to pi-ai
 *
 * Features:
 *   - Smart routing: when model is "clawrouter/auto", classify query and pick cheapest model.
 *   - SSE heartbeat: for streaming requests, sends headers + heartbeat immediately
 *     before upstream responds, preventing OpenClaw's 10-15s timeout.
 *   - Response dedup: hashes request bodies and caches responses for 30s,
 *     preventing double-charging when OpenClaw retries after timeout.
 *   - Usage logging: log every request as JSON line to ~/.openclaw/clawrouter/logs/
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import {
  route,
  DEFAULT_ROUTING_CONFIG,
  type RouterOptions,
  type RoutingDecision,
  type RoutingConfig,
  type ModelPricing,
} from "./router/index.js";
import { ROUTER_MODELS } from "./models.js";
import { logUsage, type UsageEntry } from "./logger.js";
import { RequestDeduplicator } from "./dedup.js";

const OPENROUTER_API = "https://openrouter.ai/api";
const AUTO_MODEL = "clawrouter/auto";
const USER_AGENT = "clawrouter/0.4.0";
const HEARTBEAT_INTERVAL_MS = 2_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 180_000; // 3 minutes
const DEFAULT_PORT = 8402;

export type ProxyOptions = {
  apiKey: string;
  apiBase?: string;
  /** Port to listen on (default: 8402) */
  port?: number;
  routingConfig?: Partial<RoutingConfig>;
  /** Request timeout in ms (default: 180000 = 3 minutes). */
  requestTimeoutMs?: number;
  onReady?: (port: number) => void;
  onError?: (error: Error) => void;
  onRouted?: (decision: RoutingDecision) => void;
};

export type ProxyHandle = {
  port: number;
  baseUrl: string;
  close: () => Promise<void>;
};

/**
 * Build model pricing map from ROUTER_MODELS.
 */
function buildModelPricing(): Map<string, ModelPricing> {
  const map = new Map<string, ModelPricing>();
  for (const m of ROUTER_MODELS) {
    if (m.id === AUTO_MODEL) continue; // skip meta-model
    map.set(m.id, { inputPrice: m.inputPrice, outputPrice: m.outputPrice });
  }
  return map;
}

/**
 * Merge partial routing config overrides with defaults.
 */
function mergeRoutingConfig(overrides?: Partial<RoutingConfig>): RoutingConfig {
  if (!overrides) return DEFAULT_ROUTING_CONFIG;
  return {
    ...DEFAULT_ROUTING_CONFIG,
    ...overrides,
    classifier: { ...DEFAULT_ROUTING_CONFIG.classifier, ...overrides.classifier },
    scoring: { ...DEFAULT_ROUTING_CONFIG.scoring, ...overrides.scoring },
    tiers: { ...DEFAULT_ROUTING_CONFIG.tiers, ...overrides.tiers },
    overrides: { ...DEFAULT_ROUTING_CONFIG.overrides, ...overrides.overrides },
  };
}

/**
 * Start the local proxy server.
 *
 * Returns a handle with the assigned port, base URL, and a close function.
 */
export async function startProxy(options: ProxyOptions): Promise<ProxyHandle> {
  const apiBase = options.apiBase ?? OPENROUTER_API;

  // Build router options (100% local -- no external API calls for routing)
  const routingConfig = mergeRoutingConfig(options.routingConfig);
  const modelPricing = buildModelPricing();
  const routerOpts: RouterOptions = {
    config: routingConfig,
    modelPricing,
  };

  // Request deduplicator (shared across all requests)
  const deduplicator = new RequestDeduplicator();

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Health check
    if (req.url === "/health" || req.url?.startsWith("/health?")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // Only proxy paths starting with /v1
    if (!req.url?.startsWith("/v1")) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    try {
      await proxyRequest(
        req,
        res,
        apiBase,
        options,
        routerOpts,
        deduplicator,
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      options.onError?.(error);

      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: { message: `Proxy error: ${error.message}`, type: "proxy_error" },
          }),
        );
      } else if (!res.writableEnded) {
        // Headers already sent (streaming) -- send error as SSE event
        res.write(
          `data: ${JSON.stringify({ error: { message: error.message, type: "proxy_error" } })}\n\n`,
        );
        res.write("data: [DONE]\n\n");
        res.end();
      }
    }
  });

  // Listen on requested port (default: 8402)
  const listenPort = options.port ?? DEFAULT_PORT;

  return new Promise<ProxyHandle>((resolve, reject) => {
    server.on("error", reject);

    server.listen(listenPort, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      const port = addr.port;
      const baseUrl = `http://127.0.0.1:${port}`;

      options.onReady?.(port);

      resolve({
        port,
        baseUrl,
        close: () =>
          new Promise<void>((res, rej) => {
            server.close((err) => (err ? rej(err) : res()));
          }),
      });
    });
  });
}

/**
 * Proxy a single request through to the OpenRouter API.
 *
 * Features applied in order:
 *   1. Smart routing -- when model is "clawrouter/auto", pick cheapest capable model
 *   2. Dedup check -- if same request body seen within 30s, replay cached response
 *   3. Streaming heartbeat -- for stream:true, send 200 + heartbeats immediately
 */
async function proxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  apiBase: string,
  options: ProxyOptions,
  routerOpts: RouterOptions,
  deduplicator: RequestDeduplicator,
): Promise<void> {
  const startTime = Date.now();

  // Build upstream URL: /v1/chat/completions -> https://openrouter.ai/api/v1/chat/completions
  const upstreamUrl = `${apiBase}${req.url}`;

  // Collect request body
  const bodyChunks: Buffer[] = [];
  for await (const chunk of req) {
    bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  let body = Buffer.concat(bodyChunks);

  // --- Smart routing ---
  let routingDecision: RoutingDecision | undefined;
  let isStreaming = false;
  let maxTokens = 4096;
  const isChatCompletion = req.url?.includes("/chat/completions");

  if (isChatCompletion && body.length > 0) {
    try {
      const parsed = JSON.parse(body.toString()) as Record<string, unknown>;
      isStreaming = parsed.stream === true;
      maxTokens = (parsed.max_tokens as number) || 4096;

      if (parsed.model === AUTO_MODEL) {
        // Extract prompt from messages
        type ChatMessage = { role: string; content: string };
        const messages = parsed.messages as ChatMessage[] | undefined;
        let lastUserMsg: ChatMessage | undefined;
        if (messages) {
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === "user") {
              lastUserMsg = messages[i];
              break;
            }
          }
        }
        const systemMsg = messages?.find((m: ChatMessage) => m.role === "system");
        const prompt = typeof lastUserMsg?.content === "string" ? lastUserMsg.content : "";
        const systemPrompt = typeof systemMsg?.content === "string" ? systemMsg.content : undefined;

        routingDecision = route(prompt, systemPrompt, maxTokens, routerOpts);

        // Replace model in body
        parsed.model = routingDecision.model;
        body = Buffer.from(JSON.stringify(parsed));

        options.onRouted?.(routingDecision);
      }
    } catch {
      // JSON parse error -- forward body as-is
    }
  }

  // --- Dedup check ---
  const dedupKey = RequestDeduplicator.hash(body);

  // Check completed cache first
  const cached = deduplicator.getCached(dedupKey);
  if (cached) {
    res.writeHead(cached.status, cached.headers);
    res.end(cached.body);
    return;
  }

  // Check in-flight -- wait for the original request to complete
  const inflight = deduplicator.getInflight(dedupKey);
  if (inflight) {
    const result = await inflight;
    res.writeHead(result.status, result.headers);
    res.end(result.body);
    return;
  }

  // Register this request as in-flight
  deduplicator.markInflight(dedupKey);

  // --- Streaming: early header flush + heartbeat ---
  let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
  let headersSentEarly = false;

  if (isStreaming) {
    // Send 200 + SSE headers immediately, before upstream responds
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    headersSentEarly = true;

    // First heartbeat immediately
    res.write(": heartbeat\n\n");

    // Continue heartbeats every 2s while waiting for upstream
    heartbeatInterval = setInterval(() => {
      if (!res.writableEnded) {
        res.write(": heartbeat\n\n");
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  // Forward headers, stripping host, connection, and content-length
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (
      key === "host" ||
      key === "connection" ||
      key === "transfer-encoding" ||
      key === "content-length"
    )
      continue;
    if (typeof value === "string") {
      headers[key] = value;
    }
  }
  if (!headers["content-type"]) {
    headers["content-type"] = "application/json";
  }
  headers["user-agent"] = USER_AGENT;

  // OpenRouter authentication and best-practice headers
  headers["authorization"] = `Bearer ${options.apiKey}`;
  headers["http-referer"] = "https://github.com/clawrouter";
  headers["x-title"] = "ClawRouter";

  // --- Client disconnect cleanup ---
  let completed = false;
  res.on("close", () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = undefined;
    }
    // Remove from in-flight if client disconnected before completion
    if (!completed) {
      deduplicator.removeInflight(dedupKey);
    }
  });

  // --- Request timeout ---
  const timeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Make the request to OpenRouter
    const upstream = await fetch(upstreamUrl, {
      method: req.method ?? "POST",
      headers,
      body: body.length > 0 ? body : undefined,
      signal: controller.signal,
    });

    // Clear timeout -- request succeeded
    clearTimeout(timeoutId);

    // Clear heartbeat -- real data is about to flow
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = undefined;
    }

    // --- Stream response and collect for dedup cache ---
    const responseChunks: Buffer[] = [];

    if (headersSentEarly) {
      // Streaming: headers already sent. Check for upstream errors.
      if (upstream.status !== 200) {
        const errBody = await upstream.text();
        const errEvent = `data: ${JSON.stringify({ error: { message: errBody, type: "upstream_error", status: upstream.status } })}\n\n`;
        res.write(errEvent);
        res.write("data: [DONE]\n\n");
        res.end();

        // Cache the error response for dedup
        const errBuf = Buffer.from(errEvent + "data: [DONE]\n\n");
        deduplicator.complete(dedupKey, {
          status: 200, // we already sent 200
          headers: { "content-type": "text/event-stream" },
          body: errBuf,
          completedAt: Date.now(),
        });
        return;
      }

      // Pipe upstream SSE data to client
      if (upstream.body) {
        const reader = upstream.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
            responseChunks.push(Buffer.from(value));
          }
        } finally {
          reader.releaseLock();
        }
      }

      res.end();

      // Cache for dedup
      deduplicator.complete(dedupKey, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
        body: Buffer.concat(responseChunks),
        completedAt: Date.now(),
      });
    } else {
      // Non-streaming: forward status and headers from upstream
      const responseHeaders: Record<string, string> = {};
      upstream.headers.forEach((value, key) => {
        if (key === "transfer-encoding" || key === "connection") return;
        responseHeaders[key] = value;
      });

      res.writeHead(upstream.status, responseHeaders);

      if (upstream.body) {
        const reader = upstream.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
            responseChunks.push(Buffer.from(value));
          }
        } finally {
          reader.releaseLock();
        }
      }

      res.end();

      // Cache for dedup
      deduplicator.complete(dedupKey, {
        status: upstream.status,
        headers: responseHeaders,
        body: Buffer.concat(responseChunks),
        completedAt: Date.now(),
      });
    }

    // Mark request as completed (for client disconnect cleanup)
    completed = true;
  } catch (err) {
    // Clear timeout on error
    clearTimeout(timeoutId);

    // Clear heartbeat on error
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = undefined;
    }

    // Remove in-flight entry so retries aren't blocked
    deduplicator.removeInflight(dedupKey);

    // Convert abort error to more descriptive timeout error
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }

    throw err;
  }

  // --- Usage logging (fire-and-forget) ---
  if (routingDecision) {
    const entry: UsageEntry = {
      timestamp: new Date().toISOString(),
      model: routingDecision.model,
      cost: routingDecision.costEstimate,
      latencyMs: Date.now() - startTime,
    };
    logUsage(entry).catch(() => {});
  }
}
