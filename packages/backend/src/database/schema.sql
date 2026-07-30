-- Users table with OAuth support
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  profile_picture_url TEXT,
  native_language VARCHAR(50) DEFAULT 'Tamil',
  current_level VARCHAR(10) DEFAULT 'A1',
  learning_goal TEXT,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OAuth accounts table for storing OAuth provider information
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_user_id)
);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Magic links table
CREATE TABLE IF NOT EXISTS magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vocabulary categories table
CREATE TABLE IF NOT EXISTS vocabulary_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_number INTEGER NOT NULL,
  track_name VARCHAR(100) NOT NULL,
  category_number INTEGER NOT NULL,
  category_name VARCHAR(100) NOT NULL,
  description TEXT,
  difficulty_level VARCHAR(10),
  estimated_words_count INTEGER,
  icon VARCHAR(50),
  color_code VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vocabulary words table
CREATE TABLE IF NOT EXISTS vocabulary_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES vocabulary_categories(id) ON DELETE CASCADE,
  word VARCHAR(255) NOT NULL,
  pronunciation VARCHAR(255),
  word_type VARCHAR(50),
  cefr_level VARCHAR(10),
  frequency VARCHAR(20) DEFAULT 'Medium',
  english_meaning TEXT,
  tamil_meaning TEXT,
  core_idea TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(category_id, word)
);

-- Vocabulary lessons table (6 sections)
CREATE TABLE IF NOT EXISTS vocabulary_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id UUID NOT NULL UNIQUE REFERENCES vocabulary_words(id) ON DELETE CASCADE,
  
  -- Memory Mastery Section
  memory_trigger TEXT,
  visual_scene TEXT,
  sound_association TEXT,
  tamil_connection TEXT,
  emotional_hook TEXT,
  memory_sentence TEXT,
  recall_question TEXT,
  pattern_family TEXT,
  
  -- Meaning Expansion Section
  meaning_layer_1_literal JSONB,
  meaning_layer_2_abstract JSONB,
  meaning_layer_3_figurative JSONB,
  meaning_layer_4_professional JSONB,
  
  -- Usage Mastery Section
  usage_profile JSONB,
  word_usage_zones TEXT,
  natural_domains TEXT[],
  domain_restrictions JSONB,
  context_switching_test JSONB,
  word_nature VARCHAR(150),
  register VARCHAR(150),
  common_contexts TEXT[],
  tamil_usage_notes TEXT,
  
  -- Application Section
  examples JSONB,
  collocations JSONB,
  native_usage_patterns TEXT,
  common_mistakes JSONB,
  confusion_zone TEXT,
  alternatives_synonyms JSONB,
  frequency_by_context JSONB,
  
  -- Mastery Section
  mini_conversation TEXT,
  learn_pattern TEXT,
  guided_practice JSONB,
  evaluation JSONB,
  feedback_template TEXT,
  mastery_notes TEXT,
  native_thinking_model TEXT,
  lesson_data JSONB,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User progress table
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES vocabulary_words(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES vocabulary_categories(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'not_started',
  proficiency_level INTEGER DEFAULT 0,
  times_reviewed INTEGER DEFAULT 0,
  times_correct INTEGER DEFAULT 0,
  times_incorrect INTEGER DEFAULT 0,
  last_reviewed_at TIMESTAMP,
  next_review_at TIMESTAMP,
  ease_factor NUMERIC(4, 2) DEFAULT 2.5,
  interval INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, word_id)
);

-- Flashcard queue table
CREATE TABLE IF NOT EXISTS flashcard_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES vocabulary_words(id) ON DELETE CASCADE,
  progress_id UUID NOT NULL REFERENCES user_progress(id) ON DELETE CASCADE,
  queue_position INTEGER,
  due_at TIMESTAMP NOT NULL,
  card_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, word_id)
);

-- Learning sessions table
CREATE TABLE IF NOT EXISTS learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES vocabulary_categories(id) ON DELETE SET NULL,
  session_type VARCHAR(50),
  duration_minutes INTEGER,
  words_studied INTEGER,
  words_mastered INTEGER,
  accuracy_percentage NUMERIC(5, 2),
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Learning paths table
CREATE TABLE IF NOT EXISTS learning_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  path_name VARCHAR(100),
  target_level VARCHAR(10),
  category_sequence UUID[],
  current_category_index INTEGER DEFAULT 0,
  progress_percentage NUMERIC(5, 2) DEFAULT 0,
  estimated_completion_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Grammar topics table
CREATE TABLE IF NOT EXISTS grammar_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_name VARCHAR(255) NOT NULL,
  cefr_level VARCHAR(10),
  rule TEXT,
  structure TEXT,
  purpose TEXT,
  usage TEXT,
  common_mistakes JSONB,
  tamil_speaker_mistakes JSONB,
  tamil_comparison TEXT,
  examples JSONB,
  practice_exercises JSONB,
  evaluation_questions JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Communication topics table
CREATE TABLE IF NOT EXISTS communication_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_name VARCHAR(255) NOT NULL,
  scenario TEXT,
  key_phrases TEXT[],
  natural_responses TEXT[],
  professional_language TEXT,
  tone_guidance TEXT,
  communication_strategy TEXT,
  role_play_scenarios JSONB,
  case_studies JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Translation cache table
CREATE TABLE IF NOT EXISTS translation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_text TEXT NOT NULL,
  source_language VARCHAR(10) DEFAULT 'en',
  target_language VARCHAR(10) DEFAULT 'ta',
  translated_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_text, source_language, target_language)
);

-- ChatGPT generation history table
CREATE TABLE IF NOT EXISTS chatgpt_generation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  word_id UUID REFERENCES vocabulary_words(id) ON DELETE SET NULL,
  category_id UUID REFERENCES vocabulary_categories(id) ON DELETE SET NULL,
  prompt_used TEXT,
  chatgpt_response JSONB,
  generated_lesson JSONB,
  validation_status VARCHAR(50),
  validation_errors JSONB,
  tokens_used INTEGER,
  api_cost NUMERIC(10, 4),
  auto_saved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ChatGPT generation queue table
CREATE TABLE IF NOT EXISTS chatgpt_generation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  word VARCHAR(255) NOT NULL,
  category_id UUID REFERENCES vocabulary_categories(id) ON DELETE SET NULL,
  cefr_level VARCHAR(10),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT
);

-- User grammar progress table
CREATE TABLE IF NOT EXISTS user_grammar_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  grammar_id UUID NOT NULL REFERENCES grammar_topics(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'not_started',
  proficiency_level INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, grammar_id)
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX idx_oauth_accounts_provider ON oauth_accounts(provider, provider_user_id);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(token);
CREATE INDEX idx_vocabulary_words_category_id ON vocabulary_words(category_id);
CREATE INDEX idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX idx_user_progress_word_id ON user_progress(word_id);
CREATE INDEX idx_user_progress_status ON user_progress(status);
CREATE INDEX idx_flashcard_queue_user_id ON flashcard_queue(user_id);
CREATE INDEX idx_flashcard_queue_due_at ON flashcard_queue(due_at);
CREATE INDEX idx_learning_sessions_user_id ON learning_sessions(user_id);
CREATE INDEX idx_translation_cache_source ON translation_cache(source_text, source_language, target_language);
CREATE INDEX idx_chatgpt_history_user_id ON chatgpt_generation_history(user_id);
CREATE INDEX idx_chatgpt_history_word_id ON chatgpt_generation_history(word_id);
CREATE INDEX idx_chatgpt_queue_status ON chatgpt_generation_queue(status);
