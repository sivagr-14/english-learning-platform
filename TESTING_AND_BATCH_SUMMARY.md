# Testing & Batch Processing Summary

## 📊 Quick Answer to Your Questions

### Question 1: How to test it within the app itself?

**Answer**: Simple 5-step process in the UI at `http://localhost:3000/import`

1. Start all services: `npm run dev`, `npm run worker`, `redis-server`
2. Navigate to: http://localhost:3000/import
3. Paste text or upload file (.pdf, .docx, .epub, .srt, .txt)
4. Click "Start import" and watch real-time progress bar
5. Verify new words appear in /dashboard within 1-2 minutes

**Full testing guide**: See [TESTING_AND_BATCH_PROCESSING.md](TESTING_AND_BATCH_PROCESSING.md#part-1-testing-within-the-app-complete-guide)

---

### Question 2: Batch Processing for Large Files (Cost Reduction)?

**Answer**: YES ✅ Gemini API supports batch processing with **50% cost reduction**

#### Cost Comparison

```
For 100K words document:

Real-time (Current):
  Cost: $0.0165
  Time: 1-2 minutes

Batch API:
  Cost: $0.0127 (save $0.004)
  Time: 1+ hour wait
  Reduction: 23% cheaper
```

#### Monthly Savings (1,000 imports)

```
Real-time: $16.50/month
Batch:     $12.75/month
Savings:   $3.75/month (23% reduction)
```

#### Implementation Status

| Option | Implementation Effort | Cost Savings | Recommended |
|--------|----------------------|--------------|-------------|
| **Real-time (Current)** | ✅ Done | None | ✅ Now |
| **Batch Processing** | 4-6 hours | 23% per job | 📅 Later |
| **Hybrid** (User chooses) | 6-8 hours | Variable | 💡 Best |

---

## 🎯 Quick Start Testing

### Prerequisites (3 min)
```bash
# 1. Get API key (free from Google AI Studio)
# Visit: https://aistudio.google.com/app/apikey

# 2. Configure
echo "PRIMARY_AI_API_KEY=AIzaSy_YOUR_KEY" >> .env.local

# 3. Install deps
yarn install
```

### Run Tests (5 min)
```bash
# Terminal 1
npm run dev

# Terminal 2
npm run worker

# Terminal 3
redis-server
```

### Test in Browser
```
1. Open: http://localhost:3000/import
2. Paste this text:

"Programming requires understanding algorithms, data structures, and 
design patterns. Developers must comprehend asynchronous programming, 
distributed systems, and microservices architecture. Key concepts include 
eventual consistency, message queues, and circuit breaker patterns."

3. Click "Start import"
4. Watch progress: Extracting → Assessing → Generating → Validating → Committed
5. Expect: 5-10 new vocabulary words in dashboard
6. Time: 1-2 minutes total
7. Cost: ~$0.001
```

---

## 📈 Testing Scenarios

### Scenario 1: Small Text (Baseline)
- Input: 500 words
- Time: 1-2 min
- Cost: $0.001-0.002
- Expected: 5-15 words

### Scenario 2: PDF File
- Input: 10-page PDF
- Time: 3-5 min
- Cost: $0.01-0.02
- Expected: 40-60 words

### Scenario 3: Large Document
- Input: 50+ pages
- Time: 10-20 min
- Cost: $0.10-0.15
- Expected: 100-200 words

### Scenario 4: Multiple Imports
- Input: 5 documents concurrently
- Expected: Jobs queue and process sequentially
- Max concurrent: GENERATION_WORKER_CONCURRENCY setting (default: 2)

---

## 🔋 Batch Processing Details

### When Available
- ✅ Document size > 50K words
- ✅ User accepts 1+ hour wait
- ✅ Cost savings matter (large operations)

### How It Works
```
Real-time flow:
Submit → [Gemini API] → Get result → Commit
         (1-2 sec)

Batch flow:
Submit → Batch Queue → [Gemini API] → Poll status → Get result → Commit
         (instant)    (in background)    (1+ hour)
```

### Cost Formula

```
Real-time cost:
(input_tokens × $0.075/M + output_tokens × $0.30/M) / 1,000,000

Batch cost (50% off input):
(input_tokens × $0.0375/M + output_tokens × $0.30/M) / 1,000,000
                 ↑ Half price!
```

### Implementation Roadmap

**Phase 1 (Now)**: Real-time only ✅
- Simple, fast (1-2 min per document)
- Cost: Full price
- Status: Working

**Phase 2 (Optional)**: Add batch support
- Cost: 4-6 hours development
- Benefit: 23% cost reduction
- Use case: When processing 1000+ imports/month

**Phase 3 (Optional)**: Hybrid approach
- Let users choose: "Save time (pay full) vs Save money (wait 1hr)"
- Frontend checkbox: "Batch processing?"
- Intelligently selects batch for large files

---

## 🗂️ Documentation References

| Document | Purpose | Read Time |
|----------|---------|-----------|
| [TESTING_AND_BATCH_PROCESSING.md](TESTING_AND_BATCH_PROCESSING.md) | Complete testing guide + batch API details | 30 min |
| [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) | Step-by-step setup guide | 20 min |
| [GEMINI_QUICK_REFERENCE.md](GEMINI_QUICK_REFERENCE.md) | Quick lookup tables | 5 min |
| [GEMINI_API_GUIDE.md](GEMINI_API_GUIDE.md) | Technical deep dive | 45 min |
| [VISUAL_COST_COMPARISON.md](VISUAL_COST_COMPARISON.md) | Visual charts & matrices | 20 min |

---

## 💾 Database Queries for Testing

### Monitor Import Progress
```sql
SELECT 
  id,
  source_name,
  status,
  stage_progress::jsonb as progress,
  created_at
FROM generation_jobs 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

### Check Costs
```sql
SELECT 
  source_name,
  tokens_used::jsonb -> 'input_tokens' as input_tokens,
  tokens_used::jsonb -> 'output_tokens' as output_tokens,
  actual_cost,
  created_at
FROM generation_jobs 
WHERE status = 'committed'
ORDER BY created_at DESC LIMIT 10;
```

### Validate Results
```sql
SELECT COUNT(*) as new_words
FROM words 
WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## ⚡ Performance & Cost Summary

### Current Implementation (Real-time)
```
Document Size    Time        Cost        Words Generated
─────────────────────────────────────────────────────────
500 words        1-2 min     $0.001      5-15 words
10 pages         3-5 min     $0.01       40-60 words
50 pages         10-20 min   $0.10       100-200 words
```

### With Batch Processing (23% Savings)
```
Document Size    Time        Cost        Savings
──────────────────────────────────────────────
500 words        1+ hour     $0.0007     $0.0003
10 pages         1+ hour     $0.0075     $0.0025
50 pages         1+ hour     $0.075      $0.025
```

**Use batch when**:
- Document > 50K words
- Can wait 1+ hours
- Processing 1000+ items/month

---

## ✅ Testing Checklist

### Basic Functionality
- [ ] Navigate to http://localhost:3000/import
- [ ] Upload text successfully
- [ ] See progress bar update
- [ ] New words appear in dashboard
- [ ] Worker logs show API calls

### File Type Support
- [ ] Plain text (.txt)
- [ ] Markdown (.md)
- [ ] PDF (.pdf)
- [ ] Word document (.docx)
- [ ] Subtitle file (.srt)
- [ ] eBook (.epub)

### Cost Tracking
- [ ] tokens_used populated in database
- [ ] actual_cost calculated correctly
- [ ] Actual cost ≈ estimate from formula

### Error Handling
- [ ] Invalid API key → clear error message
- [ ] Missing file → validation error
- [ ] Large file → graceful handling
- [ ] Network error → automatic retry

### Concurrent Processing
- [ ] Multiple imports submit successfully
- [ ] Jobs queue based on GENERATION_WORKER_CONCURRENCY
- [ ] No API rate limit errors
- [ ] All complete successfully

---

## 🚀 Next Steps

1. **Test now** (5 minutes):
   - Open /import page
   - Paste sample text
   - Watch it complete in 1-2 minutes

2. **Monitor costs** (Ongoing):
   - Check database after each test
   - Compare actual vs. estimate
   - Verify token tracking

3. **Consider batch processing** (Later):
   - Implement if 1000+ imports/month
   - 4-6 hour development effort
   - 23% cost reduction benefit

4. **Optimize prompts** (Advanced):
   - Fine-tune system prompts
   - Reduce token usage
   - Improve lesson quality

---

## 📞 Quick Reference

**API Endpoint**: `/api/generation/jobs`
**Frontend Page**: `/import`
**Worker Process**: `npm run worker`
**Database Table**: `generation_jobs`
**Key Columns**: `status`, `tokens_used`, `actual_cost`, `stage_progress`

**Real-time API cost**: $0.075/M input + $0.30/M output
**Batch API cost**: $0.0375/M input + $0.30/M output (50% off input!)
**Typical document**: ~$0.01-0.15 depending on size

**Completion time**: 1-2 minutes (real-time) vs 1+ hours (batch)

---

## FAQ

**Q: Can I test right now?**
A: Yes! Just run `npm run dev`, `npm run worker`, and open http://localhost:3000/import

**Q: Will batch processing slow things down?**
A: Yes, batch takes 1+ hours vs 1-2 minutes real-time, but saves 23% on costs.

**Q: Can I use both?**
A: Yes! Hybrid approach lets users choose at import time.

**Q: Do I need to implement batch now?**
A: No. Start with real-time (current). Add batch later if needed.

**Q: What if real-time API is slow?**
A: Typical latency is 1-2 seconds per API call. If slower, check network/API status.

**Q: Can I increase GENERATION_WORKER_CONCURRENCY?**
A: Yes, but watch for API rate limits. Start with 2-3, increase cautiously.

