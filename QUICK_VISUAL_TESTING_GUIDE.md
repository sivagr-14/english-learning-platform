# Quick Visual Guide: Testing & Batch Processing

## 🎯 Test in 60 Seconds

```
Step 1: Services Ready?        Step 2: Go to UI            Step 3: Submit
═════════════════════          ══════════════             ═════════════
✅ npm run dev                 http://localhost:3000/import
✅ npm run worker              
✅ redis-server                Paste sample text OR      Click
                               upload .pdf file          "Start import"
                               ↓
                               [Paste English text here]
                               
                                               ↓
                                               
Step 4: Watch Progress                  Step 5: Verify
═══════════════════════════             ══════════════════
Queued                → 🟢 ✓            Go to /dashboard
↓                                       
Reading document      → 🟢 ✓ (1-2 sec)  
↓                                       New words appear! ✅
Finding vocabulary    → 🟢 ✓ (5-10 sec)
↓                                       Cost: ~$0.001-0.02
Writing lessons       → 🟢 ✓ (30 sec)   
↓                                       Time: 1-2 minutes
Checking quality      → 🟢 ✓ (5 sec)
↓
Done! ✅ (1-2 minutes total)
```

---

## 💰 Cost Comparison at a Glance

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Document: 100K words (10-20 pages)                   │
│                                                         │
│  REAL-TIME API (Current) ─────────────────────────────│
│  ├─ Cost: $0.0165                                     │
│  ├─ Time: 1-2 minutes                                 │
│  └─ Best for: Most use cases                         │
│                                                         │
│  BATCH API (Optional) ───────────────────────────────│
│  ├─ Cost: $0.0127 ← 23% Cheaper!                     │
│  ├─ Time: 1+ hours                                    │
│  └─ Best for: Large documents, non-urgent            │
│                                                         │
│  SAVINGS: $0.004 per document                         │
│  MONTHLY (1000 docs): $4.00/month                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Testing Flow Diagram

```
                    YOU
                     │
                     ▼
            http://localhost:3000/import
                     │
         ┌───────────┴────────────┐
         │                        │
         ▼ (Text)                 ▼ (File)
    [Paste text]           [Upload .pdf/.docx]
         │                        │
         └───────────┬────────────┘
                     │
                     ▼
            "Start import" button
                     │
                     ▼
    /api/generation/jobs (POST)
                     │
                     ▼
         Generation Job Created ✓
                     │
                     ▼
    Worker Process (npm run worker)
         │           │           │          │
         ▼           ▼           ▼          ▼
      Extract   Assess   Generate   Validate
      (1-2s)   (5-10s)    (30s)      (5s)
         │           │           │          │
         └───────────┴───────────┴──────────┘
                     │
                     ▼
         Commit to Database ✓
                     │
                     ▼
    /dashboard shows new words ✓
```

---

## 🎛️ Real-Time vs Batch Processing

```
REAL-TIME (Current Implementation)
════════════════════════════════════

Submit Job
    ↓
    └─→ Gemini API Call
         ├─ Assessment: "What are key words?" (5-10 sec)
         ├─ Generation: "Write lesson for each" (30 sec)
         └─ Result: Immediate ✓
    ↓
Commit & Show in Dashboard
    
⏱️  Total Time: 1-2 minutes
💰 Cost: $0.075/M input (full price)
✅ Best for: Most users


BATCH PROCESSING (Optional, Future)
════════════════════════════════════

Submit Job
    ↓
    └─→ Queue for Batch
         └─ Store request with ID
    ↓
Background: Wait in Batch Queue
    │
    ├─ 1 hour passes...
    │
    ▼
Gemini Batch API Processes
    ├─ Assessment: "What are key words?" 
    ├─ Generation: "Write lesson for each"
    └─ Result: Batch completes
    ↓
Poll Status (every 5 min)
    │
    ├─ Still processing...
    ├─ Still processing...
    │
    ▼
Complete! ✓
    ↓
Commit & Show in Dashboard

⏱️  Total Time: 1+ hour
💰 Cost: $0.0375/M input (50% discount!)
✅ Best for: Large documents, cost-sensitive


COMPARISON
══════════════════════════════════════════
                Real-time    Batch       Hybrid
─────────────────────────────────────────────
Speed           1-2 min     1+ hour     User chooses
Cost            Full        23% off     Variable
Complexity      Simple      Complex     Medium
Recommended     ✅ NOW      📅 Later    💡 Best
Implementation  ✅ Done     4-6 hours   6-8 hours
```

---

## 📈 File Type Support

```
┌──────────────────────────────────────────────────┐
│  SUPPORTED FILE TYPES                            │
├──────────────────────────────────────────────────┤
│                                                  │
│  ✅ Plain Text    (.txt, .md)                   │
│     └─ Instant parsing                          │
│                                                  │
│  ✅ PDF           (.pdf)                        │
│     └─ Text extraction via pdf-parse            │
│     └─ Typical: 10-15K words per 10 pages      │
│                                                  │
│  ✅ Word Doc      (.docx)                       │
│     └─ Extraction via mammoth library           │
│     └─ Preserves formatting                    │
│                                                  │
│  ✅ Subtitle      (.srt)                        │
│     └─ Grouped by timing gaps                   │
│     └─ Creates pseudo-paragraphs                │
│                                                  │
│  ✅ eBook         (.epub)                       │
│     └─ Per-chapter extraction                   │
│     └─ HTML stripped to text                    │
│                                                  │
│  ❌ Image PDF     (OCR not implemented)        │
│     └─ Shows clear error: "Scanned PDF?"       │
│     └─ Next step: Add Tesseract.js OCR         │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 🔧 Settings Reference

```
Environment Variable               Default        Purpose
─────────────────────────────────────────────────────────────
PRIMARY_AI_PROVIDER               gemini         Which AI service
PRIMARY_AI_MODEL                  gemini-2.5-flash  Fast model
PRIMARY_AI_API_KEY                (required)     Your API key

ESCALATION_AI_PROVIDER            gemini         Fallback service
ESCALATION_AI_MODEL               gemini-2.5-pro  Stronger model
ESCALATION_AI_API_KEY             (optional)     Can be same key

GENERATION_WORKER_CONCURRENCY     2              Max jobs in flight

ENABLE_BATCH_PROCESSING           false          Use batch API?
BATCH_MINIMUM_DOCUMENT_SIZE       50000          Batch for this size+
BATCH_RESPONSE_TIMEOUT            3600000        Wait 1 hour (ms)
```

---

## 🧪 Quick Test Cases

```
TEST CASE 1: Text Import (Fastest)
───────────────────────────────────
✓ Click /import
✓ Paste 500 words
✓ Click "Start import"
⏱️ Expect: 1-2 minutes
💰 Cost: $0.001-0.002
✅ Verify: New words in dashboard


TEST CASE 2: PDF Upload (Medium)
──────────────────────────────────
✓ Click /import
✓ Upload 10-page PDF
✓ Click "Start import"
⏱️ Expect: 3-5 minutes
💰 Cost: $0.01-0.02
✅ Verify: 40-60 words generated


TEST CASE 3: Large Document (Comprehensive)
──────────────────────────────────────────────
✓ Click /import
✓ Upload 50+ page document
✓ Click "Start import"
⏱️ Expect: 10-20 minutes
💰 Cost: $0.10-0.15
✅ Verify: 100+ words, costs tracked
✅ Check: worker logs for escalations


TEST CASE 4: Multiple Concurrent (Stress)
────────────────────────────────────────────
✓ Submit 5 documents rapidly
✓ Watch "Recent imports" section
⏱️ Expect: Process sequentially
✅ Verify: Max concurrent = GENERATION_WORKER_CONCURRENCY


TEST CASE 5: Cost Validation (Accuracy)
──────────────────────────────────────────
✓ Run import
✓ Check database:
   SELECT tokens_used, actual_cost FROM generation_jobs
✓ Calculate: 
   Cost = (input × $0.075 + output × $0.30) / 1M
✅ Verify: Actual ≈ calculated
```

---

## 🎓 What Gets Created

```
When you submit an import:

VOCABULARY WORDS
├─ 5-50 words depending on document size
├─ English term (e.g., "paradigm")
├─ Part of speech (noun, verb, etc.)
├─ CEFR level (A1-C2)
└─ Category (e.g., "Computing & Technology")

8-SECTION LESSONS (per word)
├─ 1. Meaning & Usage Profile
│   └─ meaning_type, connotation, tone, register
├─ 2. Meaning in Context
│   └─ source_sentence, contextual_meaning, explanation
├─ 3. Usage Guide
│   └─ when_to_use[], when_not_to_use[]
├─ 4. Patterns & Collocations
│   └─ main_pattern, common_collocations[]
├─ 5. Examples in Use
│   └─ example_sentences[]
├─ 6. Similar & Related Words
│   └─ synonyms[], antonyms[], related[]
├─ 7. Common Mistakes
│   └─ mistakes[], corrections[]
└─ 8. Advanced Nuance
    └─ register_specifics, cultural_context, etc.

All generated by AI, validated by 40+ quality checks
```

---

## 📊 Monitoring Dashboard

```
http://localhost:3000/import (Real-time)
├─ Recent imports list
├─ Status for each: Queued / Extracting / Assessing / Generating / Committed / Failed
├─ Stage progress: e.g., "Generating 5/12 lessons"
└─ Errors highlighted if any

Database Monitoring (Advanced)
├─ SELECT * FROM generation_jobs WHERE status = 'committed'
├─ Show: source_name, tokens_used, actual_cost, created_at
├─ Updated in real-time as job progresses
└─ Cost tracking per job

Worker Logs (Terminal)
├─ Shows every step of processing
├─ API calls with timestamps
├─ Validation results
└─ Final commit confirmation
```

---

## ✅ Success Checklist

```
□ API key added to .env.local
□ All services running (dev, worker, redis)
□ /import page loads without errors
□ Can paste text successfully
□ Can upload file successfully
□ Progress bar appears and updates
□ Status changes from Queued → Extracting → ... → Done
□ Worker logs show "Committed X words"
□ New words appear in /dashboard
□ Tokens_used populated in database
□ Actual_cost calculated correctly
□ No API errors in logs

If all checked: ✅ You're ready to use the feature!
```

---

## 🚀 One-Minute Setup

```
COPY & PASTE (One line each):

1. Add API key:
   echo "PRIMARY_AI_API_KEY=AIzaSy_YOUR_KEY" >> .env.local

2. Install deps:
   yarn install

3. Start services (3 terminals):
   npm run dev &
   npm run worker &
   redis-server

4. Test:
   Open http://localhost:3000/import
   Paste text
   Click "Start import"
   Done! ✅
```

---

## 💡 Tips & Tricks

```
🔧 Optimization:
   • Set GENERATION_WORKER_CONCURRENCY=1 for stable testing
   • Increase to 5-10 for production (watch for rate limits)

📊 Debugging:
   • Check worker logs for "Gemini API error"
   • Look at database for tokens_used if cost seems off
   • Query generation_jobs status if stuck on "generating"

🎁 Advanced:
   • Later: Implement batch processing for 23% cost savings
   • Later: Add prompt optimization to reduce tokens
   • Later: Cache lessons for repeated words
   
🚨 Common Issues:
   • "API_KEY is not set" → Add PRIMARY_AI_API_KEY to .env.local
   • Jobs stuck queued → Verify npm run worker is running
   • No new words → Check database for errors in generation_jobs
```

---

**Ready to test?** Open http://localhost:3000/import now! 🎉

