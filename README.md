<div align="center">

# SimpleClawRouter

**Save 10x on LLM costs. Automatically.**

Route every request to the cheapest model that can handle it with ultra-fast local regex routing using your [OpenRouter](https://openrouter.ai) key.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://typescriptlang.org)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen.svg)](https://nodejs.org)

</div>

> **This is a fork of [BlockRun's ClawRouter](https://github.com/BlockRunAI/ClawRouter)**, a super cool weighted regex classification system that runs at lightning speed. This fork replaces the x402 crypto-wallet payment gateway with [OpenRouter](https://openrouter.ai), so you can use a standard API key instead of managing USDC wallets. If crypto x ai excited you, go check out the original repo! For a more intelligent routing endpoint, you can use [`openrouter/auto`](https://openrouter.ai/models/openrouter/auto) (powered by Not Diamond), a general-purpose model router built directly into OpenRouter."

---

```
"What is 2+2?"            → Gemini 2.5 Flash Lite $0.10/M    saved 99%
"Summarize this article"  → Gemini 3 Flash       $0.50/M    saved 98%
"Build a React component" → Claude Opus 4.6      $5.00/M    best balance
"Prove this theorem"      → Claude Opus 4.6      $5.00/M    reasoning
"Run 50 parallel searches"→ Kimi K2.5            $0.45/M    agentic swarm
```

## Why ClawRouter?

- **100% local routing** — 14-dimension weighted scoring runs on your machine in <1ms
- **15 models** — OpenAI, Anthropic, Google, DeepSeek, xAI, Moonshot, MiniMax, Z.AI, Arcee via OpenRouter
- **Standard API key** — just set `OPENROUTER_API_KEY` and go
- **Open source** — MIT licensed, fully inspectable routing logic

---

## Quick Start

```bash
# 1. Install
openclaw plugins install clawrouter-openrouter

# 2. Set your OpenRouter API key
export OPENROUTER_API_KEY=sk-or-...
# Get your key at https://openrouter.ai/keys

# 3. Restart OpenClaw to load the plugin
openclaw restart
```

**To enable smart routing**, add to `~/.openclaw/openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "clawrouter/auto"
      }
    }
  }
}
```

Or use `/model clawrouter/auto` in any conversation to switch on the fly.

Want a specific model? Use `openai/gpt-5.2` or `anthropic/claude-opus-4.6` directly — requests still go through the proxy with dedup and streaming optimizations.

---

## How Routing Works

**100% local, <1ms**

```
Request → Weighted Scorer (14 dimensions)
              │
              ├── High confidence → Pick model from tier → Done
              │
              └── Low confidence → Default to MEDIUM tier → Done
```

Routing is done through regex + weighted multi-class classification:

### 14-Dimension Weighted Scoring

| Dimension            | Weight | What It Detects                          |
| -------------------- | ------ | ---------------------------------------- |
| Reasoning markers    | 0.18   | "prove", "theorem", "step by step"       |
| Code presence        | 0.15   | "function", "async", "import", "```"     |
| Simple indicators    | 0.12   | "what is", "define", "translate"         |
| Multi-step patterns  | 0.12   | "first...then", "step 1", numbered lists |
| Technical terms      | 0.10   | "algorithm", "kubernetes", "distributed" |
| Token count          | 0.08   | short (<50) vs long (>500) prompts       |
| Creative markers     | 0.05   | "story", "poem", "brainstorm"            |
| Question complexity  | 0.05   | Multiple question marks                  |
| Constraint count     | 0.04   | "at most", "O(n)", "maximum"             |
| Imperative verbs     | 0.03   | "build", "create", "implement"           |
| Output format        | 0.03   | "json", "yaml", "schema"                 |
| Domain specificity   | 0.02   | "quantum", "fpga", "genomics"            |
| Reference complexity | 0.02   | "the docs", "the api", "above"           |
| Negation complexity  | 0.01   | "don't", "avoid", "without"              |

Weighted sum → sigmoid confidence calibration → tier selection.

### Tier → Model Mapping

| Tier      | Primary Model       | Cost/M | Savings vs Opus |
| --------- | ------------------- | ------ | --------------- |
| SIMPLE    | Gemini 2.5 Flash Lite | $0.10  | **99.8%**       |
| MEDIUM    | Gemini 3 Flash        | $0.50  | **90%**         |
| COMPLEX   | Claude Opus 4.6       | $5.00  | baseline        |
| REASONING | Claude Opus 4.6       | $5.00  | baseline        |

---

## Models

15 models across 9 providers, one API key:

| Model                        | Input $/M | Output $/M | Context | Reasoning |
| ---------------------------- | --------- | ---------- | ------- | :-------: |
| **Google**                   |           |            |         |           |
| gemini-3-flash-preview       | $0.50     | $3.00      | 1M      |    \*     |
| gemini-3-pro-preview         | $2.00     | $12.00     | 1M      |    \*     |
| gemini-2.5-flash-lite        | $0.10     | $0.40      | 1M      |    \*     |
| **Anthropic**                |           |            |         |           |
| claude-sonnet-4.5            | $3.00     | $15.00     | 1M      |    \*     |
| claude-opus-4.6              | $5.00     | $25.00     | 200K    |    \*     |
| **OpenAI**                   |           |            |         |           |
| gpt-5.2                      | $1.75     | $14.00     | 400K    |    \*     |
| gpt-5-nano                   | $0.05     | $0.40      | 400K    |    \*     |
| **xAI**                      |           |            |         |           |
| grok-4.1-fast                | $0.20     | $0.50      | 2M      |    \*     |
| grok-4-fast                  | $0.20     | $0.50      | 2M      |    \*     |
| grok-code-fast-1             | $0.20     | $1.50      | 256K    |    \*     |
| **DeepSeek**                 |           |            |         |           |
| deepseek-v3.2                | $0.25     | $0.38      | 164K    |    \*     |
| **Moonshot**                 |           |            |         |           |
| kimi-k2.5                    | $0.45     | $2.50      | 262K    |    \*     |
| **MiniMax**                  |           |            |         |           |
| minimax-m2.1                 | $0.27     | $0.95      | 197K    |    \*     |
| **Z.AI**                     |           |            |         |           |
| glm-4.7                      | $0.40     | $1.50      | 203K    |    \*     |
| **Arcee AI**                 |           |            |         |           |
| trinity-large-preview (free) | $0.00     | $0.00      | 131K    |           |

Full list: [`src/models.ts`](src/models.ts)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Application                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   ClawRouter (localhost:8402)                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ Weighted Scorer │→ │ Model Selector  │→ │ Bearer Auth │ │
│  │  (14 dimensions)│  │ (cheapest tier) │  │  (API key)  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      OpenRouter API                          │
│  → OpenAI | Anthropic | Google | DeepSeek | xAI | Moonshot   │
└─────────────────────────────────────────────────────────────┘
```

Routing is **client-side** — open source and inspectable.

### Source Structure

```
src/
├── index.ts          # Plugin entry point
├── provider.ts       # OpenClaw provider registration
├── proxy.ts          # Local HTTP proxy + Bearer auth
├── models.ts         # 15 model definitions with pricing
├── auth.ts           # API key resolution
├── logger.ts         # JSON usage logging
├── dedup.ts          # Response deduplication (prevents double-charge)
└── router/
    ├── index.ts      # route() entry point
    ├── rules.ts      # 14-dimension weighted scoring
    ├── selector.ts   # Tier → model selection
    ├── config.ts     # Default routing config
    └── types.ts      # TypeScript types
```

---

## Configuration

### Override Tier Models

```yaml
# openclaw.yaml
plugins:
  - id: "clawrouter-openrouter"
    config:
      routing:
        tiers:
          COMPLEX:
            primary: "openai/gpt-5.2"
          SIMPLE:
            primary: "deepseek/deepseek-v3.2"
```

### Override Scoring Weights

```yaml
routing:
  scoring:
    reasoningKeywords: ["proof", "theorem", "formal verification"]
    codeKeywords: ["function", "class", "async", "await"]
```

---

## Programmatic Usage

Use without OpenClaw:

```typescript
import { startProxy } from "clawrouter-openrouter";

const proxy = await startProxy({
  apiKey: process.env.OPENROUTER_API_KEY!,
  onReady: (port) => console.log(`Proxy on port ${port}`),
  onRouted: (d) => console.log(`${d.model} saved ${(d.savings * 100).toFixed(0)}%`),
});

// Any OpenAI-compatible client works
const res = await fetch(`${proxy.baseUrl}/v1/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "clawrouter/auto",
    messages: [{ role: "user", content: "What is 2+2?" }],
  }),
});

await proxy.close();
```

Or use the router directly:

```typescript
import { route, DEFAULT_ROUTING_CONFIG, ROUTER_MODELS } from "clawrouter-openrouter";

// Build pricing map
const modelPricing = new Map();
for (const m of ROUTER_MODELS) {
  modelPricing.set(m.id, { inputPrice: m.inputPrice, outputPrice: m.outputPrice });
}

const decision = route("Prove sqrt(2) is irrational", undefined, 4096, {
  config: DEFAULT_ROUTING_CONFIG,
  modelPricing,
});

console.log(decision);
// {
//   model: "openai/gpt-5.2",
//   tier: "REASONING",
//   confidence: 0.97,
//   method: "rules",
//   savings: 0.93,
//   costEstimate: 0.041,
// }
```

---

## Performance Optimizations

- **SSE heartbeat**: Sends headers + heartbeat immediately, preventing upstream timeouts
- **Response dedup**: SHA-256 hash → 30s cache, prevents double-charge on retries

---

## Differences from the Original

This is a fork of [BlockRun's ClawRouter](https://github.com/BlockRunAI/ClawRouter). The original is very cool! It uses x402 micropayments with USDC on Base for pay-per-request LLM inference — no API keys needed, just a crypto wallet.

This fork replaces that payment layer with [OpenRouter](https://openrouter.ai), which gives you:

- **Standard API key auth** instead of crypto wallet management
- **No blockchain dependencies** (removed `viem`, x402, USDC balance monitoring)
- **Same smart routing** — the 14-dimension classifier is unchanged
- **Same optimizations** — dedup, streaming heartbeat, usage logging all preserved

If you want the crypto-native approach, use the [original ClawRouter](https://github.com/BlockRunAI/ClawRouter).

---

## Troubleshooting

### "Unknown model: clawrouter/auto"

This error means the ClawRouter plugin isn't loaded.

**Fix:**

```bash
# 1. Verify plugin is installed
openclaw plugins list

# 2. If not installed
openclaw plugins install clawrouter-openrouter

# 3. Restart OpenClaw after installing

# 4. Verify proxy is running
curl http://localhost:8402/health
# Should return {"status":"ok"}
```

### "OpenRouter API key not found"

**Fix:** Set the environment variable:

```bash
export OPENROUTER_API_KEY=sk-or-...
```

Get your key at [openrouter.ai/keys](https://openrouter.ai/keys).

### Port 8402 already in use

**Fix:**

```bash
# Find what's using the port
lsof -i :8402

# Kill it or restart OpenClaw
```

---

## Development

```bash
git clone https://github.com/Not-Diamond/SimpleClawRouter.git
cd SimpleClawRouter
npm install
npm run build
npm run typecheck
```

---

## License

MIT

---

<div align="center">

Built on [BlockRun's ClawRouter](https://github.com/BlockRunAI/ClawRouter) — powered by [OpenRouter](https://openrouter.ai)

</div>
