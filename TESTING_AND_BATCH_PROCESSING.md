# Testing Import AI Feature Within the App & Batch Processing Guide

## Part 1: Testing Within the App (Complete Guide)

### 🎯 Test Flow Overview

Your app has two separate import workflows:

```
WORKFLOW 1: Manual ChatGPT Import (/generate)
└─ User shares content in ChatGPT
└─ ChatGPT manually writes lessons
└─ User imports batches via GitHub
└─ NO API cost (you pay ChatGPT subscription)

WORKFLOW 2: In-App AI Import (/import) ← NEW
└─ User uploads file or pastes text
└─ Backend extracts → assesses → generates → validates
└─ Worker processes background with Gemini API
└─ Costs ~$0.16 per 1000-page book
```

---

## Quick Testing Setup (5 Minutes)

### Prerequisites
```bash
# Verify all services running:
npm run dev          # Terminal 1: API on :5001
npm run worker       # Terminal 2: Job processor
redis-server         # Terminal 3: Redis (or docker-compose up redis)

# Verify .env.local has API key:
grep PRIMARY_AI_API_KEY .env.local
# Should output: PRIMARY_AI_API_KEY=AIzaSy...
```

### Step 1: Open Import Page
```
URL: http://localhost:3000/import
You should see:
  - Title: "Import content"
  - Textarea: "Paste an article, chapter, or any text here..."
  - File upload: "or"
  - File types: .txt, .pdf, .srt, .docx, .epub
  - Button: "Start import"
```

### Step 2: Test with Text Input
```
1. Paste this sample text:

"The complexity of modern programming requires understanding asynchronous 
patterns and distributed systems. Developers must grapple with concepts 
like eventual consistency, message queues, and circuit breakers. These 
paradigms ensure resilience and scalability across microservices architectures.
Machine learning models increasingly leverage these patterns for batch 
processing and real-time inference at scale."

2. Click "Start import"
3. Watch status change: "Queued" → "Reading document" → "Finding useful vocabulary"
```

### Step 3: Monitor Progress
```
Frontend shows:
  ✓ Queued (0 sec)
  ✓ Extracting (1-2 sec)
  ✓ Assessing - Finding useful vocabulary (5-10 sec)
  ✓ Generating - Writing lessons (30-60 sec depending on candidates found)
  ✓ Validating - Checking quality (5-10 sec)
  ✓ Committed - Done! (appears in dashboard)

Expected: Should complete in 1-2 minutes for small text
```

### Step 4: Verify Results
```
After completion:
1. Go to http://localhost:3000/dashboard
2. Navigate to any category (e.g., "Computing & Technology")
3. New vocabulary should appear
4. Open a word to see auto-generated lesson with all 8 sections
```

---

## Testing Workflows

### Test Case 1: Small Text Import (Baseline)

**Goal**: Verify feature works end-to-end

**Setup**:
```
Input: 500-word English article
Time: 1-2 minutes
Cost: ~$0.001-0.002
Expected: 5-15 vocabulary entries
```

**Test**:
1. Open http://localhost:3000/import
2. Paste 500 words about any topic
3. Click "Start import"
4. Monitor worker logs:
   ```
   [Worker] Job: job-xxx
   [Job] Extracting text...
   [Job] Found 1 chunk
   [Job] Assessing chunk...
   [Job] Found 8 candidates
   [Job] Generating lesson 1/8...
   [Job] Generating lesson 2/8...
   [Job] All lessons generated, validating...
   [Job] Committed 8 words to database
   ```
5. Check database:
   ```sql
   SELECT COUNT(*) FROM words WHERE created_at > NOW() - INTERVAL '5 min';
   -- Should show new words
   ```

**Expected Result**: ✅ New words appear in dashboard within 2 minutes

---

### Test Case 2: PDF File Upload

**Goal**: Test format extraction (PDF parsing)

**Setup**:
```
Input: 10-page PDF (any English content)
Time: 3-5 minutes
Cost: ~$0.01-0.02
Expected: 30-50 vocabulary entries
```

**Test**:
1. Create/download a sample PDF (or use existing document)
2. Open http://localhost:3000/import
3. Click file upload, select PDF
4. Click "Start import"
5. Monitor stages:
   - "Extracting" → PDF parser extracts text (~10 pages ≈ 10-15K words)
   - "Assessing" → Identifies candidates from chunks
   - "Generating" → Creates lessons
   - "Validating" → Quality checks
6. Check database:
   ```sql
   SELECT source_name, status, stage_progress FROM generation_jobs 
   WHERE status = 'committed' 
   ORDER BY created_at DESC LIMIT 1;
   ```

**Expected Result**: ✅ PDF parsed, ~40-60 words extracted and committed

---

### Test Case 3: Large Document (For Cost Testing)

**Goal**: Test cost tracking and escalation behavior

**Setup**:
```
Input: 50+ page document (book chapter)
Time: 10-20 minutes
Cost: ~$0.10-0.15
Expected: 100-200 vocabulary entries
```

**Test**:
1. Find/generate large English text (50+ pages)
2. Upload to /import page
3. Monitor worker logs for:
   - Chunk processing (should show multiple chunks)
   - Escalation triggers (if validation fails, should see "Escalating to...")
4. Track cost in database:
   ```sql
   SELECT 
     source_name,
     tokens_used::jsonb -> 'input_tokens' as input_tokens,
     tokens_used::jsonb -> 'output_tokens' as output_tokens,
     actual_cost
   FROM generation_jobs 
   WHERE status = 'committed'
   ORDER BY created_at DESC LIMIT 1;
   ```

**Expected Results**:
- ✅ Input tokens: ~50-100K (depends on text length)
- ✅ Output tokens: ~20-40K (lesson generation)
- ✅ Estimated cost: $0.10-0.15
- ✅ Few or no escalations (2-3% max)

---

### Test Case 4: Multiple Concurrent Imports

**Goal**: Test job queue and concurrency limits

**Setup**:
```
Input: Submit 5 small documents in quick succession
Time: Depends on GENERATION_WORKER_CONCURRENCY
Expected: Jobs queue and process in order
```

**Test**:
1. Open http://localhost:3000/import in multiple browser tabs
2. Rapidly submit 5 different documents (different text/files)
3. Watch "Recent imports" section:
   ```
   Import 1: "Queued" → "Extracting"
   Import 2: "Queued" (waiting)
   Import 3: "Queued" (waiting)
   ...
   ```
4. Check GENERATION_WORKER_CONCURRENCY setting:
   ```bash
   grep GENERATION_WORKER_CONCURRENCY .env.local
   # If set to 2, max 2 jobs process simultaneously
   ```
5. Monitor queue in database:
   ```sql
   SELECT 
     source_name,
     status,
     created_at
   FROM generation_jobs 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

**Expected Results**:
- ✅ Jobs queue behind each other
- ✅ Max concurrent = GENERATION_WORKER_CONCURRENCY value
- ✅ Each processes to completion
- ✅ No API overload (respects rate limits)

---

### Test Case 5: Error Handling & Recovery

**Goal**: Test failure scenarios

**Scenario A: Invalid API Key**
```
1. Edit .env.local: PRIMARY_AI_API_KEY=invalid_key
2. Restart: npm run dev (don't need to restart worker)
3. Submit import
4. Expected: Job fails with "Gemini API error (401)"
5. Fix: Restore valid key, restart
6. Job should be retryable or create new job
```

**Scenario B: Network Error**
```
1. Block internet or use invalid API endpoint temporarily
2. Submit import
3. Expected: "Connection timeout" or similar in logs
4. Worker retries automatically
5. Once network restored: Job completes
```

**Scenario C: Invalid File Format**
```
1. Try uploading .docx file that's corrupted
2. Expected: "Failed to extract text from DOCX" in error message
3. Next job works normally
```

**Scenario D: Text Too Large**
```
1. Paste extremely large text (>10MB)
2. Expected: "File too large" error before processing
3. Or graceful chunking if it gets through
```

---

### Test Case 6: Cost Validation

**Goal**: Verify actual costs match estimates

**Setup**:
```
Input: Document with known token count
Expected: Track actual vs estimated cost
```

**Test**:
```sql
-- Run after job completes
SELECT 
  id,
  source_name,
  tokens_used::jsonb as tokens,
  actual_cost,
  created_at
FROM generation_jobs 
WHERE status = 'committed'
ORDER BY created_at DESC LIMIT 5;

-- Calculate actual:
-- cost = (input_tokens × $0.075/M + output_tokens × $0.30/M) / 1,000,000
```

**Verification**:
```
Example: Job with 100K input + 30K output
Cost = (100K × 0.075 + 30K × 0.30) / 1M
     = (7.5 + 9) / 1M
     = $0.0165
```

---

## Real-Time Monitoring During Tests

### Frontend Monitoring
```
Watch in browser:
1. /import page shows live progress
2. Status bar updates every 3 seconds
3. Stage-specific progress (e.g., "Generating 5/12 lessons")
4. Errors displayed immediately
```

### Backend Monitoring
```bash
# Terminal with worker running:
npm run worker

# Should show:
[BullMQ] Connected to Redis at 127.0.0.1:6379
[Worker] Listening for generation jobs...
[Job: job-abc123] Processing...
[Job: job-abc123] Status: extracting
[Job: job-abc123] Calling Gemini API (assessment) - chunk 1/5
[Job: job-abc123] Got 8 candidates
[Job: job-abc123] Status: generating
[Job: job-abc123] Generating lesson 1/8...
[Job: job-abc123] Validation passed ✓
[Job: job-abc123] Committed 8 entries
```

### Database Monitoring
```sql
-- Monitor progress in real-time:
SELECT 
  id,
  source_name,
  status,
  stage_progress::jsonb as progress,
  updated_at
FROM generation_jobs 
ORDER BY updated_at DESC 
LIMIT 10;

-- Track costs:
SELECT 
  COUNT(*) as total_jobs,
  SUM(CASE WHEN status = 'committed' THEN 1 ELSE 0 END) as completed,
  SUM(actual_cost) as total_cost
FROM generation_jobs;
```

---

## Part 2: Gemini Batch API Options (Cost Reduction)

### 🔍 Current Implementation Status

Your current implementation uses **real-time API calls** (default):
```
Assessment:  1 API call per chunk (~30-60 sec total)
Generation:  1 API call per vocabulary entry (~30 sec total)
Result:      Fast (1-2 minutes per document) but full price
```

---

### ✅ Gemini Batch Processing API (Available!)

Google Gemini **DOES support batch processing** with **50% cost reduction** 🎉

**Key Details**:
```
API:              https://generativelanguage.googleapis.com/v1beta/cachedBatches
Cost Reduction:   50% off input tokens
Response Time:    Up to 24 hours (async)
Minimum Delay:    ~1 hour typical
Use Case:         Large document imports, non-urgent vocabulary generation
```

**Cost Comparison**:
```
Real-time API:
  Input:  100K tokens × $0.075/M = $7.50
  Output: 30K tokens × $0.30/M  = $9.00
  Total:  $16.50

Batch API:
  Input:  100K tokens × $0.0375/M = $3.75  (50% discount!)
  Output: 30K tokens × $0.30/M   = $9.00
  Total:  $12.75 → Saves $3.75 per import!
```

**Monthly Savings** (1,000 imports):
```
Real-time: 1000 × $0.0165 = $16.50/month
Batch:     1000 × $0.0127 = $12.75/month
Savings:   $3.75/month (23% reduction!)
```

**Trade-off**:
```
Real-time:  ✅ 1-2 minutes per import
            ❌ Full cost
Batch:      ✅ 50% cost savings
            ❌ 1 hour+ wait before results
```

---

### 🚀 Batch Processing Implementation Options

#### Option 1: Hybrid Strategy (RECOMMENDED)

```typescript
// Priority 1: Real-time (urgent imports)
if (document.priority === 'urgent' || document.size < 5000) {
  use realtime API  // Small documents, immediate results
}

// Priority 2: Batch (background processing)
if (document.priority === 'background' || document.size > 50000) {
  use batch API    // Large documents, cost savings
}
```

**Configuration**:
```env
# New environment variable
ENABLE_BATCH_PROCESSING=true
BATCH_MINIMUM_DOCUMENT_SIZE=50000  # words
BATCH_RESPONSE_TIMEOUT=3600000     # 1 hour (ms)

# Or user chooses at import time:
# Frontend checkbox: "Process in background for lower cost?"
```

**Implementation**:
```typescript
// In generation.worker.ts, before calling assessChunk():

const shouldUseBatch = 
  process.env.ENABLE_BATCH_PROCESSING === 'true' &&
  extractedText.length > BATCH_MINIMUM_SIZE;

if (shouldUseBatch) {
  // Submit to batch queue
  const batchRequest = await callGeminiBatch(
    config,
    systemPrompt,
    chunks
  );
  // Store batchId in generation_jobs table
  await jobService.updateStatus(jobId, 'batch_queued', {
    batchId: batchRequest.id,
    estimatedCompletionTime: new Date(Date.now() + 3600000)
  });
  // Polling job checks batch status periodically
} else {
  // Use real-time API (current implementation)
  raw = await callGemini(config, systemPrompt, userPrompt);
}
```

---

#### Option 2: Scheduled Batch Processing

```
Use Case: Run batch jobs on schedule (nightly, off-peak hours)
Benefit: Predictable costs, consistent throughput
Trade-off: Always wait until next scheduled run
```

**Implementation**:
```bash
# New cron job (separate from worker):
npm run batch-processor

# Runs at:
# - 2:00 AM every day (off-peak)
# - Processes all "batch_queued" jobs
# - Checks batch API status periodically
# - Marks complete and triggers downstream tasks
```

---

#### Option 3: User-Controlled Choice

```
Frontend UI:
  ☐ Process immediately (full cost)
  ☐ Process in background (50% off, 1hr+ wait)

User selects based on urgency + budget
```

---

### 📋 Batch API Implementation Checklist

If you want to add batch processing:

- [ ] Review Gemini Batch API docs: https://ai.google.dev/api/rest/v1beta/cachedBatches
- [ ] Create new migration: `add_batch_id_to_generation_jobs`
  ```sql
  ALTER TABLE generation_jobs ADD COLUMN batch_id VARCHAR(255);
  ALTER TABLE generation_jobs ADD COLUMN batch_status VARCHAR(50);
  ALTER TABLE generation_jobs ADD COLUMN batch_completion_time TIMESTAMP;
  ```
- [ ] Create `batch-processor.service.ts`
  ```typescript
  export async function submitBatchRequest(
    requests: BatchRequest[],
    config: AiProviderConfig
  ): Promise<string> {
    // POST to cachedBatches endpoint
    // Return batch ID
  }
  
  export async function pollBatchStatus(
    batchId: string,
    config: AiProviderConfig
  ): Promise<BatchStatus> {
    // Check batch completion
  }
  ```
- [ ] Create `batch-polling.worker.ts`
  ```typescript
  // Separate worker that polls batch status
  // Triggered periodically (every 5 minutes)
  ```
- [ ] Update UI to show estimated completion time
- [ ] Add database queries to track batch jobs

**Estimated Implementation**: 4-6 hours for basic version

---

### 💡 Recommendation

**For your current use case**:

1. **Start with real-time** (current implementation)
   - Works great for typical usage
   - 1-2 minute completion time is acceptable
   - Batch API adds complexity

2. **Add batch processing when**:
   - Handling 1000+ imports/month consistently
   - Users need to import large books (100+ pages)
   - Want to reduce costs by 23%

3. **Hybrid approach**:
   ```env
   ENABLE_BATCH_PROCESSING=true
   BATCH_MINIMUM_DOCUMENT_SIZE=100000  # Only batch for 100K+ word documents
   ```

---

## Database Schema for Batch Support

If you want to add batch processing later:

```sql
-- Extend generation_jobs to track batch state
ALTER TABLE generation_jobs ADD COLUMN (
  processing_mode VARCHAR(20) DEFAULT 'realtime',  -- 'realtime' or 'batch'
  batch_id VARCHAR(255),
  batch_submission_time TIMESTAMP,
  batch_estimated_completion TIMESTAMP,
  batch_status VARCHAR(50),
  batch_error_message TEXT
);

-- New table to track batch requests
CREATE TABLE generation_batch_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id VARCHAR(255) NOT NULL UNIQUE,
  submitted_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  generation_job_ids UUID[] NOT NULL,
  status VARCHAR(50),
  cost_saved DECIMAL(8,4),
  error_message TEXT
);

-- Polling history
CREATE TABLE batch_polling_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id VARCHAR(255) NOT NULL,
  polled_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50),
  completion_percent INT
);
```

---

## Current Costs (Real-Time vs Batch)

### Monthly Cost Scenarios

```
SCENARIO: 500 imports/month, 50 pages average

Real-Time (Current):
  Input: 500 × 50K tokens = 25M
  Output: 500 × 15K tokens = 7.5M
  Cost: (25M × $0.075 + 7.5M × $0.30) / 1M = $4.50/month

With Batch (50% discount on input):
  Input: 500 × 50K tokens × 0.5 = 12.5M
  Output: 500 × 15K tokens = 7.5M
  Cost: (12.5M × $0.075 + 7.5M × $0.30) / 1M = $2.81/month
  
Savings: $1.69/month (37% reduction!)
```

---

## Testing Batch Processing (When Implemented)

```sql
-- Check batch status
SELECT 
  id,
  processing_mode,
  batch_id,
  batch_status,
  batch_estimated_completion,
  actual_cost
FROM generation_jobs 
WHERE processing_mode = 'batch'
ORDER BY created_at DESC;

-- Track cost savings
SELECT 
  COUNT(*) as total_batch_jobs,
  SUM(cost_saved) as total_savings
FROM generation_batch_requests 
WHERE status = 'completed';
```

---

## Summary

### Current Implementation
✅ Real-time API calls (1-2 minute turnaround)
✅ Full price ($0.075/M input, $0.30/M output)
✅ Simple, works great

### Batch API Available
✅ 50% discount on input tokens
✅ Can save $1-5/month per 500 imports
✅ Requires 1+ hour wait
❌ More complex implementation

### Recommendation
1. **Now**: Stick with real-time (current implementation)
2. **When volume grows**: Implement batch for large documents
3. **Hybrid approach**: Use batch for 100K+ word documents, real-time for small

**Implementation effort**: 4-6 hours for basic batch support if needed later.

