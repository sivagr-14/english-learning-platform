# Gemini API Integration & Cost-Effective Strategy Guide

## Current Architecture Overview

Your app uses a **two-tier AI provider strategy** for vocabulary lesson generation:

### Primary Tier (High-Volume, Cost-Optimized)
- **Default Model**: `gemini-2.5-flash` (latest fastest Gemini model)
- **Purpose**: Candidate assessment, first-pass lesson generation
- **Use Case**: Every document chunk and initial vocabulary proposal
- **Escalation Trigger**: When validators reject output quality

### Escalation Tier (Premium, Quality Fallback)
- **Default Model**: `gemini-2.5-pro` (advanced reasoning)
- **Purpose**: Retry failed entries, handle ambiguous word senses
- **Frequency**: Only when primary-tier output fails quality checks
- **Optional**: Can use same API key as primary tier

---

## Testing the Import AI Pipeline

### 1. **Setup Environment**

```bash
# Copy template and add your Gemini API keys
cp .env.example .env.local

# Edit .env.local with your API keys:
PRIMARY_AI_PROVIDER=gemini
PRIMARY_AI_MODEL=gemini-2.5-flash
PRIMARY_AI_API_KEY=YOUR_GEMINI_API_KEY_HERE

ESCALATION_AI_PROVIDER=gemini
ESCALATION_AI_MODEL=gemini-2.5-pro
ESCALATION_AI_API_KEY=YOUR_GEMINI_API_KEY_HERE  # Can be same key as above

GENERATION_WORKER_CONCURRENCY=2
```

### 2. **Start the System**

```bash
# Install dependencies (new packages added: bullmq, ioredis, pdf-parse, etc.)
yarn install

# Terminal 1: Start API server
npm run dev

# Terminal 2: Start worker queue processor (CRITICAL - this runs the pipeline)
npm run worker

# Terminal 3: Start Redis (if not already running in Docker)
redis-server
```

### 3. **Test via UI**

Navigate to http://localhost:3000/import and test:
- **Text input**: Paste English text or sample content
- **File upload**: Try .txt, .pdf, .docx, .epub, or .srt files
- **Monitor progress**: Watch stages: extracting → assessing → generating → validating → committed

### 4. **Test via API**

```bash
# Direct API call with text
curl -X POST http://localhost:5001/api/generation/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "sourceName": "test-doc",
    "sourceType": "text",
    "sourceContent": "Your English text here with vocabulary to extract..."
  }'

# Poll for job status
curl http://localhost:5001/api/generation/jobs/JOB_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. **Monitor Processing**

- **Frontend**: Real-time progress bar at `/import` page
- **Worker logs**: Check `GENERATION_WORKER_CONCURRENCY` (set to 2, meaning 2 jobs run concurrently max)
- **Database**: Check `generation_jobs` table for status tracking
- **Failure handling**: Failed entries automatically escalate to pro model or skip if escalation disabled

---

## Cost-Effective Strategies: Gemini vs OpenRouter vs Google AI Studio

### Option 1: **Google AI Studio (Free, Development Only)**

**Pros:**
- ✅ Free tier: 60 requests per minute
- ✅ $0 cost for development/testing
- ✅ No billing setup required
- ✅ Get API keys in 2 minutes

**Cons:**
- ❌ No production support (TOS violation)
- ❌ Limited throughput (60 req/min)
- ❌ No volume discounts
- ❌ Can't use for real user content

**Cost**: Free for development

**Setup**:
```
1. Go to https://aistudio.google.com/app/apikey
2. Click "Create API Key"
3. Copy key → paste in .env.local
```

**Use Case**: Local testing only, prototype validation

---

### Option 2: **Google Cloud Gemini API (Direct) - RECOMMENDED FOR PRODUCTION**

**Pros:**
- ✅ **Lowest cost**: $0.075/M input tokens, $0.30/M output (Flash)
- ✅ Volume discounts available at scale
- ✅ Full SLA + production support
- ✅ Can batch requests for 50% discount
- ✅ Fine-tuning available (future cost savings)

**Cons:**
- ⚠️ Requires Google Cloud Project + billing setup
- ⚠️ Pay-as-you-go (no free tier at production scale)
- ⚠️ ~15 min setup time

**Pricing Breakdown** (per 1M tokens):
```
gemini-2.5-flash:    $0.075 input / $0.30 output
gemini-2.5-pro:      $1.50 input / $6.00 output (40x more expensive)
gemini-2.0-flash:    $0.10 input / $0.40 output
```

**Monthly Cost Estimate** (example: 1,000 documents, ~2M tokens/doc):
- Primary tier only: **~$600-800/month** (2B tokens/month)
- 5% escalation rate: **~$700-900/month**

**Setup**:
```bash
1. Create Google Cloud Project: console.cloud.google.com
2. Enable Gemini API
3. Create service account with Gemini permissions
4. Download JSON key or create standard API key
5. Set PRIMARY_AI_API_KEY in .env.local
```

**Code works as-is** (you're already using direct Google Gemini API endpoint)

---

### Option 3: **OpenRouter - Proxy Aggregator**

**Pros:**
- ✅ Same Google Gemini pricing, no markup
- ✅ Single account, switch models easily
- ✅ Better error handling + failover to other providers
- ✅ Usage credits (get $5-10 free)
- ✅ Simpler than Google Cloud project setup

**Cons:**
- ⚠️ OpenAI-compatible format (different API call structure)
- ⚠️ Adds ~50-100ms latency (proxy layer)
- ⚠️ Slightly less direct support
- ⚠️ Volume discounts not as deep

**Pricing**: Same as Google Gemini (no OpenRouter markup on Gemini)
```
gemini-2.5-flash via OpenRouter:  $0.075 input / $0.30 output (NO MARKUP)
```

**Setup with OpenRouter**:

1. Create account: https://openrouter.ai
2. Get API key from settings
3. Update `.env.local`:
```env
PRIMARY_AI_PROVIDER=openai
PRIMARY_AI_MODEL=google/gemini-2.5-flash
PRIMARY_AI_API_KEY=sk-or-v1-YOUR_OPENROUTER_KEY

ESCALATION_AI_PROVIDER=openai
ESCALATION_AI_MODEL=google/gemini-pro
ESCALATION_AI_API_KEY=sk-or-v1-YOUR_OPENROUTER_KEY
```

**Code change needed** in `ai-provider.service.ts`:
```typescript
// In callOpenAiCompatible function, change baseUrl for OpenRouter
const baseUrl = "https://openrouter.ai/api/v1";
```

---

### Option 4: **Hybrid Strategy (Recommended for Scale)**

**Best cost optimization**: Use primary tier caching + selective escalation

```env
# Primary: cheapest fast model
PRIMARY_AI_PROVIDER=gemini
PRIMARY_AI_MODEL=gemini-2.5-flash
PRIMARY_AI_API_KEY=your-google-api-key

# Escalation: only for 2-3% of entries
ESCALATION_AI_PROVIDER=gemini
ESCALATION_AI_MODEL=gemini-2.0-flash  # Cheaper fallback instead of pro
ESCALATION_AI_API_KEY=your-google-api-key
```

**Cost optimization techniques in your code**:
1. **Validator-gated escalation**: Only escalates when `vocabularyLessonQualityIssues` catches problems (~2-5% rate)
2. **Sequential processing**: Avoids parallel API costs
3. **Sense detection**: Ambiguous words → escalation tier automatically
4. **Manifest batching**: Entries bundled in batch operations

---

## Comparison Table

| Feature | Google AI Studio | Google Gemini API | OpenRouter |
|---------|------------------|------------------|------------|
| **Cost/1M tokens** | Free | $0.075-$1.50 | $0.075-$1.50 |
| **Production Ready** | ❌ No | ✅ Yes | ✅ Yes |
| **Setup Time** | 2 min | 15 min | 5 min |
| **Throughput** | 60 req/min | Unlimited | Unlimited |
| **Volume Discounts** | ❌ No | ✅ Yes (2-20%) | ⚠️ Limited |
| **Support** | Community | Enterprise SLA | Community |
| **Existing Code** | ✅ Works | ✅ Works | ⚠️ Minor change |
| **Failover/Routing** | No | No | ✅ Yes (Anthropic, etc.) |

---

## Recommended Setup for Your Use Case

### Development Phase
```bash
# Use Google AI Studio for quick testing (free)
PRIMARY_AI_API_KEY=YOUR_GOOGLE_AI_STUDIO_KEY
GENERATION_WORKER_CONCURRENCY=2
```

### Production Phase
```bash
# Use Google Gemini API directly (lowest cost at scale)
PRIMARY_AI_PROVIDER=gemini
PRIMARY_AI_MODEL=gemini-2.5-flash
PRIMARY_AI_API_KEY=YOUR_GOOGLE_CLOUD_API_KEY

ESCALATION_AI_PROVIDER=gemini
ESCALATION_AI_MODEL=gemini-2.0-flash  # Use Flash instead of Pro for cost
ESCALATION_AI_API_KEY=YOUR_GOOGLE_CLOUD_API_KEY

GENERATION_WORKER_CONCURRENCY=2  # Increase if needed, watch costs
```

---

## Cost Estimation Examples

Assuming your platform:
- 1,000 user imports/month
- Average 2M tokens per import (books/articles)
- 3% escalation rate

**Monthly Costs**:
- **Primary tier only**: 2B tokens × $0.075 = **$150/month**
- **With 3% escalation to Flash**: 2.06B tokens × $0.075 + 60M × $0.30 = **$165/month**
- **If using Pro escalation**: 2.06B × $0.075 + 60M × $6.00 = **$516/month** ❌ Avoid

**Recommendation**: Use Flash for both tiers, only escalate on genuine validation failures (~2-3%).

---

## Monitoring & Cost Control

Add these checks to your implementation:

1. **Token tracking** (already in response): Update `generation_jobs` with `tokens_used`
2. **Cost estimation**: Pre-calculate cost before starting job
3. **Rate limiting**: Respect `GENERATION_WORKER_CONCURRENCY` (max concurrent API calls)
4. **Error budgeting**: Set threshold for escalation escalations

Example tracking in `generation.worker.ts`:
```typescript
// After API call:
const { usageMetadata } = data;
await db('generation_jobs')
  .where({ id: jobId })
  .update({
    tokens_used: JSON.stringify(usageMetadata),
    actual_cost: (usageMetadata.input_tokens * 0.075 + 
                  usageMetadata.output_tokens * 0.30) / 1_000_000
  });
```

---

## Testing Checklist

- [ ] Set API key in `.env.local`
- [ ] Start worker process (`npm run worker`)
- [ ] Test text input at `/import` page
- [ ] Monitor worker logs for API calls
- [ ] Check `generation_jobs` table for status progression
- [ ] Verify lesson content quality in `words` table
- [ ] Test escalation: intentionally corrupt a prompt to trigger escalation
- [ ] Check cost tracking (tokens_used populated)

