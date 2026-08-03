# Quick Reference: API Key Setup & Cost Comparison

## TL;DR - Quick Setup

### For Development (Free)
```bash
# 1. Get key: https://aistudio.google.com/app/apikey
# 2. Add to .env.local:
PRIMARY_AI_API_KEY=your_google_ai_studio_key

# 3. Start: npm run dev && npm run worker
```

### For Production (Recommended)
```bash
# 1. Setup Google Cloud: console.cloud.google.com
# 2. Enable Gemini API, get API key
# 3. Add to .env.local:
PRIMARY_AI_PROVIDER=gemini
PRIMARY_AI_MODEL=gemini-2.5-flash
PRIMARY_AI_API_KEY=your_google_cloud_key
ESCALATION_AI_MODEL=gemini-2.0-flash  # Cheaper than pro!

# 4. Start same as above
```

---

## Provider Comparison Matrix

| Aspect | Google AI Studio | Google Gemini API | OpenRouter |
|--------|------------------|-------------------|------------|
| **Cost/1M tokens (Flash)** | Free | $0.075 input / $0.30 output | $0.075 input / $0.30 output |
| **Production Ready** | ❌ TOS violation | ✅ SLA available | ✅ Yes |
| **Setup Time** | 2 min | 15 min | 5 min |
| **API Endpoint** | Google AI Studio | `generativelanguage.googleapis.com` | `openrouter.ai/api/v1` |
| **Throughput** | 60 req/min | Unlimited* | Unlimited* |
| **Volume Discounts** | None | 2-20% at scale | Limited |
| **Billing** | Free tier only | Pay-as-you-go | Pay-as-you-go |
| **Support** | Community | Google Cloud Support | Community |
| **Works with existing code** | ✅ Yes | ✅ Yes | ⚠️ Needs 1 line change |
| **Failover/Routing** | No | No | ✅ Yes |

---

## Model Pricing Reference

### Gemini Models (Recommended)

| Model | Input Cost | Output Cost | Recommendation | Use Case |
|-------|-----------|------------|-----------------|----------|
| **gemini-2.5-flash** | $0.075/M | $0.30/M | ⭐ **PRIMARY** | Fast, cheap, accurate enough |
| **gemini-2.0-flash** | $0.10/M | $0.40/M | ⭐ **ESCALATION** | Fallback for failed entries |
| **gemini-2.5-pro** | $1.50/M | $6.00/M | ❌ **AVOID** | 20x more expensive than Flash |
| **gemini-1.5-pro** | $3.50/M | $10.50/M | ❌ **DON'T USE** | Outdated |

### Alternative Models (Not Recommended)

| Model | Input Cost | Output Cost | Why Not |
|-------|-----------|------------|---------|
| GPT-4 Turbo | $10/M | $30/M | 133x more expensive |
| Claude 3 Sonnet | $3/M | $15/M | 40x more expensive |
| Llama 2 (OpenRouter) | $0.20/M | $0.20/M | Lower quality output |

---

## Cost Scenarios

### Small Test (1 document, 50 pages)
- **Tokens**: ~100K input, ~30K output
- **Cost**: ~$0.015
- **Recommendation**: Use Google AI Studio (free)

### Medium Project (10 documents)
- **Tokens**: ~1M input, ~300K output
- **Cost**: ~$0.15
- **Recommendation**: Start with Google AI Studio, graduate to Cloud

### Monthly Scale (1,000 documents)
- **Tokens**: ~100M input, ~30M output
- **Cost**: ~$15-20/month
- **Recommendation**: Google Gemini API directly (lowest cost)

### Enterprise Scale (10K documents/month)
- **Tokens**: ~1B input, ~300M output
- **Cost**: ~$150-200/month
- **Recommendation**: Google Cloud + Volume discounts + Cache optimization

---

## Setup Checklist

### Step 1: Get API Key ✓
- [ ] Decide: Google AI Studio (dev) vs Google Cloud (prod) vs OpenRouter (flexible)
- [ ] Create account and get API key
- [ ] Store key securely (never commit to git)

### Step 2: Configure Code ✓
- [ ] Copy `.env.example` → `.env.local`
- [ ] Add `PRIMARY_AI_API_KEY=<your-key>`
- [ ] Keep `PRIMARY_AI_PROVIDER=gemini` (default)
- [ ] Set `GENERATION_WORKER_CONCURRENCY=2`

### Step 3: Install Dependencies ✓
- [ ] Run `yarn install` (installs bullmq, pdf-parse, etc.)
- [ ] Verify no errors

### Step 4: Start Services ✓
- [ ] Terminal 1: `npm run dev` (API server)
- [ ] Terminal 2: `npm run worker` (Job queue processor - CRITICAL)
- [ ] Terminal 3: `redis-server` (If not in Docker)

### Step 5: Test ✓
- [ ] Visit http://localhost:3000/import
- [ ] Paste sample text or upload PDF
- [ ] Monitor worker logs for API calls
- [ ] Check database: `SELECT * FROM generation_jobs`

### Step 6: Monitor Costs ✓
- [ ] Log into Google Cloud Console → Billing
- [ ] Check daily/weekly costs
- [ ] Review token usage (`tokens_used` column in DB)
- [ ] Adjust escalation rate if needed

---

## Environment Variables (Complete Reference)

```bash
# ==================== AI PROVIDER CONFIG ====================

# Primary tier: Assessment + first-pass generation
# Used for every document chunk and initial lesson attempt
PRIMARY_AI_PROVIDER=gemini              # Options: gemini, openai, anthropic
PRIMARY_AI_MODEL=gemini-2.5-flash       # Recommended: gemini-2.5-flash
PRIMARY_AI_API_KEY=                     # REQUIRED - your API key

# Escalation tier: Only when primary-tier output fails validation
# Called ~2-3% of the time (when vocabularyLessonQualityIssues triggers)
ESCALATION_AI_PROVIDER=gemini           # Options: gemini, openai, anthropic
ESCALATION_AI_MODEL=gemini-2.0-flash    # Recommended: gemini-2.0-flash (not pro!)
ESCALATION_AI_API_KEY=                  # Can be same as PRIMARY_AI_API_KEY

# Concurrency: Max number of documents processing simultaneously
# Each concurrent job makes sequential API calls within itself
# So this is the max API calls in flight at once
GENERATION_WORKER_CONCURRENCY=2

# ==================== LEGACY CONFIG ====================
# Keep for backwards compatibility with existing flows
GEMINI_API_KEY=                         # Optional fallback

# ==================== DOCKER COMPOSE ====================
# docker-compose.yml uses these same variables
# Service will read from .env.local or your shell environment
```

---

## Testing Commands

### Test with cURL (Need JWT Token)
```bash
# Create a job
curl -X POST http://localhost:5001/api/generation/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "sourceName": "test-document",
    "sourceType": "text",
    "sourceContent": "Your English text to extract vocabulary from..."
  }'

# Poll job status
curl http://localhost:5001/api/generation/jobs/{JOB_ID} \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Check Database Progress
```sql
-- See all generation jobs
SELECT 
  id, 
  source_name, 
  status, 
  created_at, 
  updated_at 
FROM generation_jobs 
ORDER BY created_at DESC 
LIMIT 20;

-- See specific job details
SELECT * FROM generation_jobs WHERE id = 'JOB_ID';

-- Check tokens used (for cost tracking)
SELECT 
  id, 
  tokens_used, 
  actual_cost
FROM generation_jobs 
WHERE tokens_used IS NOT NULL;
```

### Monitor Worker Process
```bash
# Watch worker logs in real-time
npm run worker

# Should see output like:
# [Worker] Processing job: job-12345
# [Worker] Extracting text...
# [Worker] Assessing chunk 1/25...
# [Worker] Calling Gemini API...
# [Worker] Generating lesson entry...
```

---

## Troubleshooting

### "API_KEY is not set"
```
→ Check .env.local has PRIMARY_AI_API_KEY=<value>
→ Restart npm run dev after editing .env.local
→ Keys are read at startup, not dynamically
```

### "Worker is not processing jobs"
```
→ Ensure npm run worker is running (separate terminal)
→ Check Redis is running: redis-cli PING → should return PONG
→ Check API server started before worker (worker needs to connect to Redis)
```

### "Gemini API error (400)"
```
→ Validate API key format
→ Check if using AI Studio key (different endpoint than Cloud)
→ If upgraded model, check JSON response format changed
```

### "Slow processing (30+ min for 100 pages)"
```
→ Reduce GENERATION_WORKER_CONCURRENCY to 1
→ Check network latency to Google API
→ Review model choice (Flash is faster than Pro)
```

### "High costs exceeding estimate"
```
→ Check escalation rate: SELECT status, COUNT(*) FROM generation_jobs GROUP BY status
→ If many "failed", escalation rate is high
→ Switch ESCALATION_AI_MODEL to gemini-2.0-flash (not pro)
→ Optimize prompts to generate fewer tokens
```

---

## Cost Optimization Tips

1. **Use Gemini Flash for both tiers** (difference between Flash vs Pro is 20x)
2. **Keep escalation rate low** (2-3% is target)
3. **Batch similar documents** (allows caching optimization later)
4. **Monitor tokens_used** (database column tracks actual usage)
5. **Don't use Pro unless absolutely necessary** (4-5% quality improvement isn't worth 20x cost)

---

## Files to Review

| File | Purpose |
|------|---------|
| `packages/backend/src/services/ai-provider.service.ts` | Main AI integration - supports Gemini/OpenAI/Anthropic |
| `packages/backend/src/queue/generation.worker.ts` | Job processor (runs separately) |
| `packages/backend/src/services/in-app-generation.service.ts` | Pipeline stages: assess → generate → validate |
| `packages/frontend/app/import/page.tsx` | UI for uploading documents & monitoring progress |
| `packages/backend/src/utils/cost-tracker.ts` | Cost estimation and tracking utilities |
| `.env.example` | Environment variable template |

---

## Next Steps

1. **Choose provider**: Google AI Studio (dev) or Google Cloud (prod)
2. **Get API key**: 2-5 minutes
3. **Run setup script**: `bash GEMINI_API_TEST.sh`
4. **Start 3 processes**: dev, worker, redis
5. **Test with sample document**: Visit `/import` page
6. **Monitor costs**: Check Google Cloud Console → Billing

---

## Questions?

- **API Reference**: https://ai.google.dev/
- **Model Comparison**: https://ai.google.dev/models/
- **Pricing Details**: https://ai.google.dev/pricing
- **OpenRouter Alternative**: https://openrouter.ai
- **Project Docs**: See `GEMINI_API_GUIDE.md` in this repo
