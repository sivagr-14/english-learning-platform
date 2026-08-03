#!/bin/bash

# GEMINI_API_TEST.sh - Quick setup and testing guide for Gemini API integration
# Usage: source ./GEMINI_API_TEST.sh

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   English Learning Platform - Gemini AI Setup Guide        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: API Key Selection
echo "📋 Step 1: Choose Your API Source"
echo "─────────────────────────────────"
echo ""
echo "1️⃣  Google AI Studio (FREE - Development Only)"
echo "   • Get key from: https://aistudio.google.com/app/apikey"
echo "   • Pros: Free, instant setup"
echo "   • Cons: 60 req/min limit, no production support"
echo "   • Perfect for: Local testing"
echo ""
echo "2️⃣  Google Cloud Gemini API (RECOMMENDED - Production)"
echo "   • Setup: console.cloud.google.com → Create Project → Enable Gemini API"
echo "   • Pros: Lowest cost ($0.075/M input tokens), full production support"
echo "   • Cons: 15 min setup, requires billing"
echo "   • Perfect for: Real usage"
echo ""
echo "3️⃣  OpenRouter (ALTERNATIVE - No markup)"
echo "   • Get key from: https://openrouter.ai/keys"
echo "   • Pros: Same pricing, simpler setup, failover support"
echo "   • Cons: Requires code change (baseUrl modification)"
echo "   • Perfect for: Want flexibility across models"
echo ""

# Step 2: Environment Setup
echo "📝 Step 2: Configure .env.local"
echo "────────────────────────────────"
echo ""

if [ ! -f .env.local ]; then
  echo "✋ .env.local not found. Creating from .env.example..."
  cp .env.example .env.local
  echo "✅ Created .env.local (edit with your API key)"
else
  echo "✅ .env.local already exists"
fi

echo ""
echo "📌 Add these lines to .env.local:"
echo ""
echo "# Option A: Google AI Studio (free, dev only)"
echo "PRIMARY_AI_PROVIDER=gemini"
echo "PRIMARY_AI_MODEL=gemini-2.5-flash"
echo "PRIMARY_AI_API_KEY=PASTE_YOUR_GOOGLE_AI_STUDIO_KEY_HERE"
echo ""
echo "# Option B: Google Cloud Gemini API (recommended)"
echo "PRIMARY_AI_PROVIDER=gemini"
echo "PRIMARY_AI_MODEL=gemini-2.5-flash"
echo "PRIMARY_AI_API_KEY=PASTE_YOUR_GOOGLE_CLOUD_KEY_HERE"
echo ""
echo "# Escalation tier (optional, can use same key as primary)"
echo "ESCALATION_AI_PROVIDER=gemini"
echo "ESCALATION_AI_MODEL=gemini-2.0-flash"
echo "ESCALATION_AI_API_KEY=PASTE_YOUR_KEY_HERE"
echo ""
echo "# Concurrency setting (max API calls in flight)"
echo "GENERATION_WORKER_CONCURRENCY=2"
echo ""

# Step 3: Dependency Check
echo "🔧 Step 3: Check Dependencies"
echo "─────────────────────────────"
echo ""

MISSING_DEPS=0

check_dependency() {
  if npm list "$1" > /dev/null 2>&1; then
    echo "✅ $1"
  else
    echo "❌ $1 (missing)"
    MISSING_DEPS=1
  fi
}

echo "Checking required packages:"
check_dependency "bullmq"
check_dependency "ioredis"
check_dependency "pdf-parse"
check_dependency "mammoth"
check_dependency "srt-parser-2"
check_dependency "epub2"

if [ $MISSING_DEPS -eq 1 ]; then
  echo ""
  echo "⚠️  Missing dependencies detected. Run:"
  echo "   yarn install"
  echo ""
else
  echo ""
  echo "✅ All dependencies installed"
fi

# Step 4: Services Check
echo ""
echo "🚀 Step 4: Start Required Services"
echo "──────────────────────────────────"
echo ""
echo "You need THREE processes running (open 3 terminal tabs):"
echo ""
echo "Terminal 1: API Server"
echo "  $ cd /Users/siva/gpt/english-learning-platform-v2/english-learning-platform"
echo "  $ npm run dev"
echo "  Expected: Backend running on http://localhost:5001"
echo ""
echo "Terminal 2: Worker Queue Processor ⚠️ CRITICAL"
echo "  $ cd /Users/siva/gpt/english-learning-platform-v2/english-learning-platform"
echo "  $ npm run worker"
echo "  Expected: Worker listening for generation jobs"
echo ""
echo "Terminal 3: Redis (if not in Docker)"
echo "  $ redis-server"
echo "  Expected: Redis ready to accept connections"
echo ""

# Step 5: Testing
echo "✅ Step 5: Test the Pipeline"
echo "────────────────────────────"
echo ""
echo "🌐 Web UI Test:"
echo "  1. Open: http://localhost:3000/import"
echo "  2. Paste sample text or upload a file"
echo "  3. Watch progress: extracting → assessing → generating → committed"
echo ""
echo "💻 API Test (with JWT token):"
echo "  curl -X POST http://localhost:5001/api/generation/jobs \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H 'Authorization: Bearer YOUR_JWT_TOKEN' \\"
echo "    -d '{\"sourceName\":\"test\",\"sourceType\":\"text\",\"sourceContent\":\"Your English text...\"}"
echo ""
echo "📊 Database Check:"
echo "  $ psql -U postgres -d english_learning -c \\"
echo "    'SELECT id, status, created_at FROM generation_jobs ORDER BY created_at DESC LIMIT 5;'"
echo ""

# Step 6: Troubleshooting
echo "⚙️  Step 6: Troubleshooting"
echo "──────────────────────────"
echo ""
echo "❌ Error: 'API_KEY is not set'"
echo "   → Check .env.local has PRIMARY_AI_API_KEY filled in"
echo "   → Restart npm run dev to pick up .env.local changes"
echo ""
echo "❌ Error: 'Worker not processing jobs'"
echo "   → Make sure npm run worker is running in separate terminal"
echo "   → Check Redis is running (redis-server)"
echo "   → Worker process must be started AFTER API server"
echo ""
echo "❌ Error: 'Gemini API error (400)'"
echo "   → Invalid API key format"
echo "   → API key might be for wrong tier (AI Studio vs Cloud)"
echo "   → Check JSON parsing if upgrading Gemini model"
echo ""
echo "❌ Error: 'Slow processing / timeouts'"
echo "   → Reduce GENERATION_WORKER_CONCURRENCY to 1"
echo "   → Check network latency to generativelanguage.googleapis.com"
echo ""

# Step 7: Cost Monitoring
echo ""
echo "💰 Step 7: Monitor Costs"
echo "──────────────────────"
echo ""
echo "Cost per million tokens (Gemini):"
echo "  • gemini-2.5-flash:  $0.075 input,  $0.30 output   ← Primary tier"
echo "  • gemini-2.5-pro:    $1.50 input,   $6.00 output   ← Avoid for escalation"
echo "  • gemini-2.0-flash:  $0.10 input,   $0.40 output   ← Cheaper escalation"
echo ""
echo "Estimated monthly cost (1,000 imports, 2M tokens/import):"
echo "  • Primary only:           ~$150/month"
echo "  • With 3% escalation:     ~$165/month"
echo "  • With Pro escalation:    ~$516/month ❌"
echo ""
echo "💡 Tip: Use gemini-2.0-flash for escalation tier, not pro"
echo ""

# Step 8: Files to Review
echo "📚 Step 8: Files to Review"
echo "─────────────────────────"
echo ""
echo "Key implementation files:"
echo ""
echo "1. Backend AI Provider:"
echo "   → packages/backend/src/services/ai-provider.service.ts"
echo "   • callGemini() - Direct Gemini API calls"
echo "   • generateJson<T>() - Main entry point"
echo "   • configFor() - Environment variable loading"
echo ""
echo "2. Generation Pipeline:"
echo "   → packages/backend/src/queue/generation.worker.ts"
echo "   • Job queue processor (runs as separate process)"
echo ""
echo "3. Import Frontend:"
echo "   → packages/frontend/app/import/page.tsx"
echo "   • POST /api/generation/jobs"
echo "   • GET /api/generation/jobs - polling"
echo ""
echo "4. Generate (Manual) Frontend:"
echo "   → packages/frontend/app/generate/page.tsx"
echo "   • Shows ChatGPT import workflow (separate from AI import)"
echo ""

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                  Ready to Test! 🎉                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "1. Add API key to .env.local"
echo "2. Run: yarn install"
echo "3. Start 3 processes (dev, worker, redis)"
echo "4. Visit: http://localhost:3000/import"
echo ""
