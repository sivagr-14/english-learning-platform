# Visual Cost & Feature Comparison Guide

## 🎯 Decision Matrix: Which API Should You Use?

```
                         GOOGLE AI STUDIO    GOOGLE CLOUD API    OPENROUTER
                         ════════════════    ════════════════    ═══════════
Purpose                  Development         Production          Flexibility
                         Testing             Real Usage          Multi-model

Cost/1M Tokens           FREE ✓              $0.075 input        $0.075 input
                         ($0.30 output)      $0.30 output        $0.30 output

Setup Time               ⚡ 2 min             ⏳ 15 min           ⚙️ 5 min
Code Changes             None ✓              None ✓              1 line

API Limit                60 req/min ⚠️       1000+ req/min ✓     Unlimited ✓

Production Ready?        ❌ TOS violation    ✅ SLA available     ✅ Yes

Volume Discounts         None                ✅ 2-20% at scale    Limited

Supports:
  - Gemini              ✅ Yes              ✅ Yes              ✅ Yes
  - OpenAI              ❌ No               ✅ Yes              ✅ Yes
  - Anthropic           ❌ No               ✅ Yes              ✅ Yes

Failover/Routing        ❌ No               ❌ No               ✅ Yes

Support Level           Community           Enterprise          Community

Billing               Free tier only       Pay-as-you-go       Pay-as-you-go

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RECOMMENDATION:
  └─ 🚀 Testing locally?     → Google AI Studio (free)
  └─ 🎯 Going to production? → Google Cloud API (lowest cost)
  └─ 🔄 Want flexibility?    → OpenRouter (no vendor lock-in)
```

---

## 💰 Cost Comparison: Real Numbers

### Example 1: Process 10 Articles (10,000 tokens each)

```
Input Tokens:   100,000 (extraction + assessment)
Output Tokens:  30,000 (lesson generation)
Primary Tier:   Gemini Flash
Escalation:     3% of entries (900 tokens × 3 entries)

┌─────────────────────────────────────────────────────────────┐
│ GOOGLE AI STUDIO (Free)                                     │
├─────────────────────────────────────────────────────────────┤
│ Cost: $0.00                                                 │
│ ⚠️ Warning: Only works for development                      │
│ ⚠️ Warning: Only 60 requests/min (might hit limit)          │
│ ✅ Perfect for: Quick testing                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ GOOGLE CLOUD API (Recommended)                              │
├─────────────────────────────────────────────────────────────┤
│ Primary: 100K input × $0.075/M + 30K output × $0.30/M      │
│       = $0.0075 + $0.009 = $0.0165                          │
│                                                             │
│ Escalation: 2.7K input × $0.10/M + 900 output × $0.40/M    │
│          = $0.00027 + $0.00036 = $0.00063                   │
│                                                             │
│ TOTAL: $0.01713 ≈ $0.017                                   │
│                                                             │
│ ✅ Production ready with SLA                               │
│ ✅ Volume discounts available                              │
│ ✅ Cost tracking per job                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ OPENROUTER (Alternative)                                    │
├─────────────────────────────────────────────────────────────┤
│ Same as Google Cloud: $0.017                                │
│                                                             │
│ Plus: ~50-100ms latency (proxy layer)                       │
│ Plus: Can switch models easily                              │
│ Plus: Built-in failover to Anthropic, etc.                │
│                                                             │
│ ✅ Same cost, more flexibility                             │
│ ✅ One line of code change needed                          │
└─────────────────────────────────────────────────────────────┘
```

### Example 2: Monthly Operations (1,000 imports)

```
Tokens per import: ~100K input + 30K output
Monthly volume:    1,000 imports

Total tokens: 100M input + 30M output

┌────────────────────────────────────┬──────────────┐
│ Provider                           │ Monthly Cost │
├────────────────────────────────────┼──────────────┤
│ Google AI Studio                   │    Free*     │
│ (*dev only, 60 req/min limit)      │              │
├────────────────────────────────────┼──────────────┤
│ Google Cloud API (Flash + 2.0)     │   $15-20     │
│ ($0.075/M input, $0.40/M output)   │              │
├────────────────────────────────────┼──────────────┤
│ Google Cloud + Pro Escalation ❌   │   $400-500   │
│ (AVOID - 20x more expensive)       │              │
├────────────────────────────────────┼──────────────┤
│ OpenRouter (same as Google)        │   $15-20     │
│ (Plus flexibility, -latency)       │              │
├────────────────────────────────────┼──────────────┤
│ OpenAI GPT-4 ❌                    │   $500-1000  │
│ (Not recommended)                  │              │
└────────────────────────────────────┴──────────────┘

Per-document cost: $0.016-$0.021
Estimated annual cost: $180-240
```

---

## 📊 Feature Comparison Table

```
FEATURE                  GOOGLE AI      GOOGLE CLOUD      OPENROUTER
                         STUDIO         API
═══════════════════════════════════════════════════════════════════════

Model Support:
  Gemini Flash           ✅             ✅                ✅
  Gemini Pro             ⚠️ Limited    ✅                ✅
  GPT-4                  ❌             ✅                ✅
  Claude                 ❌             ✅                ✅

Request Limits:
  Requests/minute        60 ⚠️          1000+ ✓           Unlimited ✓
  Daily limit            20K ⚠️         Unlimited ✓       Unlimited ✓

Cost Tracking:
  Per-request cost       ❌             ✅                ⚠️ Via logs
  Usage breakdown        ❌             ✅                ⚠️ Limited
  Invoice details        ❌             ✅                ✅

Scalability:
  1-10 imports           ✅ Great       ✅ Perfect        ✅ Perfect
  100+ imports/day       ⚠️ May limit   ✅ Perfect        ✅ Perfect
  1000+ imports/month    ❌ Won't work  ✅ Perfect        ✅ Perfect

Reliability:
  SLA                    None           99.9% ✓           Community
  Uptime monitoring      ❌             ✅                ✅
  Support channels       Community      Email, Phone       Chat

Security:
  API key rotation       Manual         ✅ Built-in       Manual
  Access controls        ❌             ✅ IAM roles      Limited
  Audit logging          ❌             ✅ Cloud Audit    Limited

Advanced:
  Caching support        ❌             ✅ Coming soon    ⚠️ Basic
  Fine-tuning            ❌             ✅ Available      Limited
  Batch processing       ❌             ✅ 50% discount    ❌
  Model switching        ❌             ⚠️ Restart needed ✅ Dynamic
```

---

## 🚀 Setup Complexity Comparison

### Google AI Studio (Simplest)
```bash
# Step 1: Get key (90 seconds)
https://aistudio.google.com/app/apikey
→ Click "Create API Key" → Copy

# Step 2: Configure (30 seconds)
echo "PRIMARY_AI_API_KEY=AIzaSy..." >> .env.local

# Step 3: Test (1 minute)
npm run dev && npm run worker
→ Visit http://localhost:3000/import

Total time: ~2 minutes
Code changes: 0
Complexity: Trivial
```

### Google Cloud API (Recommended)
```bash
# Step 1: Create project (2 minutes)
→ https://console.cloud.google.com
→ Create new project
→ Search "Generative Language API"
→ Click "Enable"

# Step 2: Create API key (5 minutes)
→ Go to "Credentials"
→ Create "API Key"
→ Copy key

# Step 3: Set up billing (5 minutes)
→ Billing section
→ Add credit card
→ Enable billing

# Step 4: Configure (30 seconds)
echo "PRIMARY_AI_API_KEY=..." >> .env.local

# Step 5: Test (1 minute)
npm run dev && npm run worker
→ Visit http://localhost:3000/import

Total time: ~15 minutes
Code changes: 0
Complexity: Moderate (billing setup)
```

### OpenRouter (Flexible)
```bash
# Step 1: Create account (2 minutes)
→ https://openrouter.ai
→ Sign up (email/GitHub)
→ Get API key from settings

# Step 2: Configure (30 seconds)
echo "PRIMARY_AI_API_KEY=sk-or-v1-..." >> .env.local

# Step 3: Code change (1 minute)
→ Edit: packages/backend/src/services/ai-provider.service.ts
→ Change: const baseUrl = "https://openrouter.ai/api/v1";
→ Change: PRIMARY_AI_MODEL=google/gemini-2.5-flash

# Step 4: Test (1 minute)
npm run dev && npm run worker
→ Visit http://localhost:3000/import

Total time: ~5 minutes
Code changes: 1 file (1 line)
Complexity: Simple
```

---

## 🎯 Decision Tree

```
Do you want to test locally first?
│
├─ YES → Use Google AI Studio
│        └─ Cost: $0 (free tier)
│           Setup: 2 minutes
│           Risk: Won't work for production (60 req/min limit)
│           Next: Graduate to Google Cloud after testing
│
└─ NO → Go to production?
         │
         ├─ Need low cost + SLA?      → Google Cloud API ⭐ RECOMMENDED
         │  └─ Cost: $0.075/M input
         │     Setup: 15 minutes
         │     Benefit: Lowest cost worldwide
         │     Benefit: Enterprise SLA
         │
         ├─ Want flexibility?          → OpenRouter
         │  └─ Cost: $0.075/M input (same!)
         │     Setup: 5 minutes
         │     Benefit: Easy model switching
         │     Trade-off: Slight latency (+50ms)
         │
         └─ Already using OpenAI?     → Keep OpenRouter
            └─ Cost: $10/M input (expensive!)
               Note: ~100x more expensive than Gemini
               Consider: Switching to Gemini saves money
```

---

## 📈 Scaling Considerations

```
                    SINGLE TEST    SMALL TEAM    PRODUCTION    ENTERPRISE
                    ═════════════  ════════════  ════════════  ═══════════

Daily Imports       1-5            10-50         100-500       1000+
Monthly Cost        < $1           $2-5          $15-50        $150-500

Recommended:
  Provider          AI Studio      AI Studio→    Cloud API     Cloud API
                    or Cloud API   Cloud API     or OpenRouter with cache
  Model             Flash          Flash         Flash + 2.0   Custom fine-tune
  Concurrency       1              2             5-10          20+

Setup Effort        2 min          5 min         15 min        30 min
Monitoring          None           Manual        Dashboard     Automated

Challenges          None           Rate limits   Cost control  Token optimization
                                   at scale      predictability budget constraints

Recommendations:
  • Start: Google AI Studio (free testing)
  • Grow:  Switch to Cloud API (cost predictable)
  • Scale: Add caching + fine-tuning (cost efficiency)
  • Max:   Consider batch processing (50% discount)
```

---

## ⚡ Performance Comparison

```
┌──────────────────────┬─────────────────┬──────────────┬──────────────┐
│ Metric               │ AI Studio       │ Google Cloud │ OpenRouter   │
├──────────────────────┼─────────────────┼──────────────┼──────────────┤
│ API Response Time    │ 1-2 seconds     │ 1-2 seconds  │ 1.5-2.5 sec  │
│ (gemini-2.5-flash)   │ (direct)        │ (direct)     │ (+proxy)     │
│                      │                 │              │              │
│ Throughput           │ 60 req/min      │ 1000+ req/min│ Unlimited    │
│ (Request limit)      │ ⚠️ LOW          │ ✅ HIGH      │ ✅ HIGH      │
│                      │                 │              │              │
│ p99 Latency          │ 5-10ms          │ 5-10ms       │ 100-150ms    │
│ (Network only)       │                 │              │ (proxy adds) │
│                      │                 │              │              │
│ Concurrent Jobs      │ ~1 safe         │ ~5-10 safe   │ ~5-10 safe   │
│ (Without hitting     │ (before 60/min) │ (very high)  │ (very high)  │
│ limits)              │                 │              │              │
│                      │                 │              │              │
│ Cost Predictability  │ N/A (free)      │ ✅ Predictable│ ✅ Predictable│
│                      │                 │              │              │
│ Escalation Ready     │ ✅ Yes (same    │ ✅ Yes       │ ✅ Yes       │
│                      │ provider)       │              │              │
└──────────────────────┴─────────────────┴──────────────┴──────────────┘
```

---

## 🎓 Learning Path

### Week 1: Experimentation
```
Day 1-2:  Set up Google AI Studio (free)
          └─ Verify feature works locally
Day 3-4:  Test with different file types
          └─ PDF, DOCX, SRT, plain text
Day 5-7:  Analyze token usage & costs
          └─ Review database: tokens_used, actual_cost
```

### Week 2-3: Optimization
```
Day 8-10:  Switch to Google Cloud API
           └─ Full production setup
Day 11-14: Run 100 imports
           └─ Monitor costs, performance, quality
Day 15-21: Tune parameters
           └─ Adjust GENERATION_WORKER_CONCURRENCY
           └─ Fine-tune prompts
           └─ Enable cost tracking
```

### Week 4+: Production
```
Ongoing:   Monitor costs weekly
           └─ Alert if exceeds budget
           Plan optimizations
           └─ Caching for repeated words
           └─ Batch processing when available
```

---

## ✅ Final Recommendation

```
╔═════════════════════════════════════════════════════════════╗
║ OPTIMAL CHOICE FOR YOUR USE CASE                            ║
╠═════════════════════════════════════════════════════════════╣
║                                                             ║
║ Phase 1: TESTING (This week)                               ║
║ ├─ Provider: Google AI Studio                              ║
║ ├─ Cost: $0 (free)                                         ║
║ ├─ Setup: 2 minutes                                        ║
║ └─ Goal: Verify feature works                              ║
║                                                             ║
║ Phase 2: DEVELOPMENT (Next 2 weeks)                        ║
║ ├─ Provider: Still Google AI Studio                        ║
║ ├─ Cost: $0 (free)                                         ║
║ ├─ Focus: Quality, prompts, validation                     ║
║ └─ Goal: Perfect the feature                               ║
║                                                             ║
║ Phase 3: PRODUCTION (Month 2+)                             ║
║ ├─ Provider: Google Cloud Gemini API                       ║
║ ├─ Cost: $0.075/M input tokens (lowest)                    ║
║ ├─ Setup: 15 minutes                                       ║
║ └─ Goal: SLA, cost tracking, scale                         ║
║                                                             ║
║ Phase 4: OPTIMIZATION (Month 3+)                           ║
║ ├─ Provider: Google Cloud + cache                          ║
║ ├─ Enhancement: Store lessons by term hash                 ║
║ ├─ Benefit: 30-50% cost reduction                          ║
║ └─ Goal: Max efficiency                                    ║
║                                                             ║
╚═════════════════════════════════════════════════════════════╝

BOTTOM LINE:
┌─────────────────────────────────────────────────────────┐
│ Start: Google AI Studio (TODAY - 2 minutes)             │
│ Switch: Google Cloud API (MONTH 2 - 15 minutes)        │
│ Cost: ~$15-20/month at scale                           │
│ Effort: Minimal (already implemented)                  │
└─────────────────────────────────────────────────────────┘
```

