# Practical Implementation: Gemini API Testing & Integration

## 📋 Implementation Overview

Your app has **two separate workflows**:

### Workflow 1: Manual (ChatGPT UI) - Existing
- **Page**: `/generate` 
- **Flow**: Paste content in ChatGPT → ChatGPT writes lessons → import to app
- **Cost**: $0 (you pay ChatGPT directly)
- **Status**: Already working ✓

### Workflow 2: In-App AI (Gemini) - NEW
- **Page**: `/import`
- **Flow**: Upload file/paste text → Gemini assessment → generation → commit
- **Cost**: Pay Google directly (~$0.075 per million input tokens)
- **Status**: Ready to test
- **Requires**: Gemini API key + worker process running

---

## 🚀 Quick Start (5 Minutes)

### 1. Get Free API Key (Google AI Studio)

```bash
# Visit this URL in your browser
https://aistudio.google.com/app/apikey

# Click "Create API Key"
# Copy the key (looks like: AIzaSy...)
```

### 2. Configure Environment

```bash
# From project root:
cd /Users/siva/gpt/english-learning-platform-v2/english-learning-platform

# Create .env.local
echo 'PRIMARY_AI_API_KEY=AIzaSy_YOUR_KEY_HERE' >> .env.local
echo 'GENERATION_WORKER_CONCURRENCY=2' >> .env.local
```

### 3. Install Dependencies

```bash
yarn install  # Installs bullmq, pdf-parse, etc.
```

### 4. Start 3 Processes

**Terminal 1:**
```bash
npm run dev  # API server on :5001
```

**Terminal 2:**
```bash
npm run worker  # Job queue processor (CRITICAL!)
```

**Terminal 3:**
```bash
redis-server  # Or if in Docker: docker-compose up redis
```

### 5. Test It

Open: **http://localhost:3000/import**

✅ Should see upload form
✅ Paste sample English text
✅ Watch status: "Queued" → "Extracting" → "Assessing" → "Generating" → "Committed"
✅ New vocabulary appears in dashboard

---

## 🔑 API Key Options Explained

### Option A: Google AI Studio (FREE - Development)
**Best for**: Testing locally, prototyping, learning

```
URL:        https://aistudio.google.com/app/apikey
Cost:       $0 (free tier only)
Limit:      60 requests/minute
Production: ❌ TOS violation - dev only
Setup:      2 minutes
Key starts: AIzaSy...
```

**Pros:**
- ✅ Completely free
- ✅ No credit card
- ✅ No billing account
- ✅ Get key in 90 seconds

**Cons:**
- ❌ Only 60 req/min (will hit limit with 3+ concurrent jobs)
- ❌ No SLA for production
- ❌ Terms forbid production use

**Use case**: "I just want to test this locally to see if it works"

---

### Option B: Google Cloud Gemini API (RECOMMENDED - Production)
**Best for**: Real usage, production deployment, cost tracking

```
URL:        console.cloud.google.com
Cost:       $0.075 per 1M input tokens (Flash)
Limit:      1000+ req/minute (quota increases with billing)
Production: ✅ Full SLA + support
Setup:      15 minutes
Key type:   Service account or API key
```

**Pros:**
- ✅ Lowest cost worldwide ($0.075/M input tokens)
- ✅ Unlimited scale (with billing)
- ✅ 24/7 production support
- ✅ Cost tracking built-in
- ✅ Volume discounts at scale

**Cons:**
- ⚠️ Requires Google Cloud project
- ⚠️ Need credit card
- ⚠️ 15 min setup
- ⚠️ Pay per usage (~$0.50-2.00/month at 100K API calls)

**Setup**:
1. Go to: https://console.cloud.google.com
2. Create new project
3. Search "Generative Language API"
4. Click "Enable"
5. Go to Credentials → Create API Key
6. Copy key to .env.local

**Use case**: "We're deploying this to production"

---

### Option C: OpenRouter (ALTERNATIVE - Flexibility)
**Best for**: Want flexibility, easy model switching, built-in failover

```
URL:        https://openrouter.ai/keys
Cost:       $0.075 per 1M input tokens (same as Google!)
Limit:      Unlimited (with billing)
Production: ✅ Yes
Setup:      5 minutes
Key starts: sk-or-v1-...
```

**Pros:**
- ✅ Same Gemini pricing (no markup!)
- ✅ Easy model switching
- ✅ Built-in failover to other providers
- ✅ $5-10 free credits on signup
- ✅ Simple sign up

**Cons:**
- ⚠️ Adds ~50-100ms latency (proxy)
- ⚠️ One line of code change needed
- ⚠️ Community support only

**Setup**:
1. Go to: https://openrouter.ai
2. Sign up
3. Copy API key from settings
4. Change 1 line in `ai-provider.service.ts` (baseUrl)

**Use case**: "I want flexibility and don't mind the tiny latency trade-off"

---

## 📊 Cost Breakdown Examples

### Scenario: Import 1 Small Article (10 pages)
- **Tokens**: ~150K input, ~40K output
- **Cost**: $0.016
- **Provider**: Any (difference negligible)

### Scenario: Import 100 Articles/Month
- **Tokens**: ~15M input, ~4M output  
- **Cost**: ~$1.65/month
- **Provider**: Google Cloud (lowest)

### Scenario: Production Platform (1K imports/month)
- **Tokens**: ~150M input, ~40M output
- **Cost**: ~$16.50/month
- **Provider**: Google Cloud + volume discount = ~$15/month

### Scenario: Large Operation (10K imports/month)
- **Tokens**: ~1.5B input, ~400M output
- **Cost**: ~$165/month
- **Provider**: Google Cloud + volume discount = ~$140/month
- **Optimization**: Consider caching identical words

---

## 🧪 Testing Workflows

### Test 1: Simple Text Import
```
1. Go to http://localhost:3000/import
2. Paste this text:
   "The lexicon of English includes vocabulary for every context. 
    Acquiring new words improves comprehension and expression."
3. Click "Generate"
4. Watch progress bar
5. Check /dashboard for new words
```

### Test 2: PDF File Upload
```
1. Create test.pdf (any English content)
2. Go to http://localhost:3000/import
3. Upload test.pdf
4. Monitor worker logs:
   [Worker] Extracting PDF...
   [Worker] Found 50 pages
   [Worker] Assessing chunks...
5. Verify words appear in dashboard
```

### Test 3: Monitor Costs in Real-Time

**Database Query**:
```sql
SELECT 
  id,
  source_name,
  status,
  tokens_used::jsonb -> 'input_tokens' as input_tokens,
  tokens_used::jsonb -> 'output_tokens' as output_tokens,
  actual_cost,
  created_at
FROM generation_jobs 
WHERE status = 'committed'
ORDER BY created_at DESC 
LIMIT 10;
```

**Expected output**:
```
| id | source_name | status | input_tokens | output_tokens | actual_cost | created_at |
|----|-------------|--------|--------------|---------------|-------------|-----------|
| job-1 | my_article | committed | 150000 | 40000 | 0.016 | 2026-08-03 |
```

### Test 4: Escalation Workflow

To test that escalation works (when primary tier fails):

```typescript
// Edit ai-provider.service.ts temporarily:
// Make primary tier intentionally fail by returning invalid JSON

async function callGemini(...) {
  // ... existing code ...
  // Temporarily return: return "INVALID_JSON_ON_PURPOSE";
  
  // This will trigger:
  // 1. Primary call fails validation
  // 2. Job marked for escalation
  // 3. Escalation tier called automatically
  // 4. Either succeeds or entry skipped
}
```

---

## ⚙️ Configuration Reference

### Minimal Setup (.env.local)
```bash
# Only required for AI import feature
PRIMARY_AI_API_KEY=AIzaSy_YOUR_KEY_HERE
```

### Recommended Production Setup
```bash
# Primary tier: Fast, cheap model
PRIMARY_AI_PROVIDER=gemini
PRIMARY_AI_MODEL=gemini-2.5-flash
PRIMARY_AI_API_KEY=YOUR_GOOGLE_CLOUD_KEY

# Escalation tier: When primary fails validation
ESCALATION_AI_PROVIDER=gemini
ESCALATION_AI_MODEL=gemini-2.0-flash  # Not pro! (40x cheaper)
ESCALATION_AI_API_KEY=YOUR_GOOGLE_CLOUD_KEY

# Concurrency: Max jobs processing simultaneously
GENERATION_WORKER_CONCURRENCY=2

# Optional: Cost tracking
TRACK_GENERATION_COSTS=true
```

### OpenRouter Alternative
```bash
# Install: no changes needed, same deps

# Change in .env.local:
PRIMARY_AI_PROVIDER=openai
PRIMARY_AI_MODEL=google/gemini-2.5-flash
PRIMARY_AI_API_KEY=sk-or-v1-YOUR_OPENROUTER_KEY

# Change in ai-provider.service.ts (1 line):
// From: const baseUrl = "https://api.openai.com/v1";
// To:   const baseUrl = "https://openrouter.ai/api/v1";
```

---

## 🔍 Monitoring & Debugging

### Check Worker Status
```bash
# Terminal with worker running:
# Should see output like:
# [BullMQ] Connected to Redis
# [Worker] Waiting for jobs...
# [Job: job-123] Processing...
# [Job: job-123] Calling Gemini API...
```

### Check API Calls
```bash
# Enable verbose logging in ai-provider.service.ts:
console.log(`[AI] Calling ${config.provider} with model ${config.model}`);
console.log(`[AI] Input tokens: ${options.userPrompt.length}`);
```

### Check Database
```sql
-- Count jobs by status
SELECT status, COUNT(*) FROM generation_jobs GROUP BY status;

-- Find failed jobs
SELECT id, source_name, error_message FROM generation_jobs 
WHERE status = 'failed' 
ORDER BY updated_at DESC LIMIT 5;

-- Total tokens used
SELECT 
  COUNT(*) as jobs,
  SUM(tokens_used::jsonb -> 'input_tokens')::int as total_input,
  SUM(tokens_used::jsonb -> 'output_tokens')::int as total_output
FROM generation_jobs 
WHERE status = 'committed';
```

### Monitor Costs
```bash
# Watch costs grow in real-time:
watch -n 5 'psql -U postgres -d english_learning -c "SELECT COUNT(*), SUM(actual_cost) FROM generation_jobs WHERE status = \x27committed\x27;"'
```

---

## ⚡ Performance Tips

### For Development
```bash
# Reduce concurrency to avoid API limit
GENERATION_WORKER_CONCURRENCY=1

# This makes everything slower but prevents 429 errors
```

### For Production
```bash
# Increase after testing
GENERATION_WORKER_CONCURRENCY=5

# Monitor costs: if too high, reduce back to 2-3
```

### Optimize Prompts
```typescript
// Current prompts in ai-provider.service.ts use ~2000 tokens
// System prompt + content + JSON instructions

// Optimization: Shorter system prompts could save 5-10% on input costs
// But careful: don't degrade output quality
```

---

## 🐛 Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "API_KEY is not set" | .env.local missing key | Add `PRIMARY_AI_API_KEY=...` |
| Jobs stuck in "queued" | Worker not running | Start `npm run worker` |
| 429 Too Many Requests | Hitting Google AI Studio 60/min limit | Switch to Google Cloud API |
| No network access error | Wrong endpoint in .env | Check `PRIMARY_AI_PROVIDER=gemini` |
| JSON parse error | Gemini returned malformed JSON | Retry (usually temporary) |
| Worker crashes | Redis connection error | Start Redis first: `redis-server` |

---

## 📈 Scaling Checklist

- [ ] Test locally with Google AI Studio (free)
- [ ] Switch to Google Cloud API
- [ ] Monitor first 100 imports for cost accuracy
- [ ] Increase `GENERATION_WORKER_CONCURRENCY` gradually (1 → 2 → 5)
- [ ] Set up cost alerts in Google Cloud Console
- [ ] Enable Gemini API caching for repeated words (future optimization)
- [ ] Consider fine-tuning prompts based on lesson quality feedback

---

## 📚 Next Steps

1. **Choose API source**: Google AI Studio (dev) or Google Cloud (prod)
2. **Get key**: 2-5 minutes
3. **Add to .env.local**: One line of config
4. **Start services**: 3 terminals (dev, worker, redis)
5. **Test at `/import`**: Upload a document
6. **Monitor**: Watch worker logs + database

**Expected result**: New vocabulary appears in your dashboard within 2-5 minutes per document

---

## ❓ FAQ

**Q: Can I use AI Studio in production?**
A: Not without violating TOS. Switch to Google Cloud before going live.

**Q: How much does it cost?**
A: Roughly $0.16 per 1,000-page import, $15-20/month at 100 imports.

**Q: What if Gemini API is down?**
A: Jobs stay queued, retry automatically when it comes back. No data loss.

**Q: Can I switch providers mid-way?**
A: Yes! Change .env.local and restart worker. In-flight jobs continue with old provider.

**Q: Do I need to pay for both primary AND escalation?**
A: Only if escalation is enabled. Default: ~3% of jobs escalate. Most skip.

**Q: Can I use different keys for primary and escalation?**
A: Yes, but they can be the same key. Set both in .env.local.

