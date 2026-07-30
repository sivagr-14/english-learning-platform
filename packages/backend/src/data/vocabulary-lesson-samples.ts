export type Frequency = "High" | "Medium" | "Low";

export interface KnowledgeCategory {
  track_number: number;
  track_name: string;
  category_number: number;
  category_name: string;
  description: string;
  difficulty_level: string;
  estimated_words_count: number;
  color_code: string;
}

export interface VocabularyLessonSample {
  track: string;
  category: string;
  word: string;
  pronunciation: string;
  word_type: string;
  cefr_level: string;
  frequency: Frequency;
  english_meaning: string;
  tamil_meaning: string;
  core_idea: string;
  memory_mastery: {
    memory_trigger: string;
    visual_scene: string;
    sound_association: string;
    tamil_connection: string;
    emotional_hook: string;
    memory_sentence: string;
    recall_question: string;
    pattern_family: string;
    notice: string;
  };
  meaning_expansion: {
    layer_1_literal: string;
    layer_2_abstract: string;
    layer_3_figurative: string;
    layer_4_professional_technical: string;
  };
  usage_mastery: {
    usage_profile: Array<{
      usage_area: string;
      status: "Yes" | "No" | "Limited";
      example_sentence: string;
      note: string;
    }>;
    word_usage_zone: {
      natural_zones: string[];
      limited_zones: string[];
      unnatural_zones: string[];
      short_explanation: string;
    };
    natural_domains: string[];
    domain_restrictions: {
      commonly_used: string[];
      rarely_used: string[];
      not_normally_used: string[];
      unnatural_example: string;
      natural_alternative: string;
      explanation: string;
    };
    context_switching_test: Array<{
      context: string;
      natural: "Yes" | "No" | "Limited";
      example: string;
    }>;
    word_nature: string;
    word_nature_reason: string;
    register: string;
    common_contexts: string[];
    tamil_usage_notes: string;
    when_to_use: string[];
    when_not_to_use: string[];
  };
  application: {
    examples: Record<string, string>;
    collocations: {
      strong: string[];
      acceptable: string[];
      unnatural: string[];
      explanation: string;
    };
    native_usage_patterns: string[];
    common_mistakes: Array<{
      incorrect: string;
      correct: string;
      explanation: string;
    }>;
    confusion_zone: string;
    alternatives_synonyms: {
      near_synonyms: string[];
      formal_alternatives: string[];
      informal_alternatives: string[];
      stronger_c1_c2_alternatives: string[];
      nuance: string;
    };
    frequency_by_context: Array<{ context: string; frequency: Frequency }>;
  };
  mastery: {
    mini_conversation: string;
    learn_the_pattern: string[];
    guided_practice: string[];
    evaluation: string[];
    feedback: string;
    mastery_notes: string;
    native_thinking_model: string;
  };
  sections?: Array<{
    number: number;
    title: string;
    content: string | string[] | Record<string, unknown> | Array<Record<string, unknown>>;
  }>;
}

export const KNOWLEDGE_VOCABULARY_CATEGORIES: KnowledgeCategory[] = [
  {
    track_number: 1,
    track_name: "Everyday Basics",
    category_number: 1,
    category_name: "Daily Life",
    description: "Common words and phrases for everyday situations.",
    difficulty_level: "A1",
    estimated_words_count: 50,
    color_code: "#2563EB",
  },
  {
    track_number: 1,
    track_name: "Everyday Basics",
    category_number: 2,
    category_name: "Daily Routines",
    description: "Words for habits, schedules, and repeated actions.",
    difficulty_level: "A1",
    estimated_words_count: 50,
    color_code: "#059669",
  },
  {
    track_number: 1,
    track_name: "Everyday Basics",
    category_number: 3,
    category_name: "Home Life",
    description: "Vocabulary for rooms, objects, chores, and family homes.",
    difficulty_level: "A1",
    estimated_words_count: 50,
    color_code: "#D97706",
  },
  {
    track_number: 1,
    track_name: "Everyday Basics",
    category_number: 4,
    category_name: "Family & Relationships",
    description: "Family members, relationships, and personal connections.",
    difficulty_level: "A1",
    estimated_words_count: 40,
    color_code: "#DB2777",
  },
  {
    track_number: 1,
    track_name: "Everyday Basics",
    category_number: 5,
    category_name: "Emotions & Personality",
    description: "Words for feelings, mood, behavior, and character.",
    difficulty_level: "A2",
    estimated_words_count: 50,
    color_code: "#7C3AED",
  },
  {
    track_number: 2,
    track_name: "Real-World Communication",
    category_number: 6,
    category_name: "Social Situations",
    description: "Natural phrases for meeting, greeting, and social exchange.",
    difficulty_level: "A2",
    estimated_words_count: 50,
    color_code: "#0891B2",
  },
  {
    track_number: 2,
    track_name: "Real-World Communication",
    category_number: 7,
    category_name: "Shopping & Money",
    description: "Words for buying, prices, payments, and money decisions.",
    difficulty_level: "A2",
    estimated_words_count: 50,
    color_code: "#16A34A",
  },
  {
    track_number: 2,
    track_name: "Real-World Communication",
    category_number: 8,
    category_name: "Food & Drink",
    description: "Food, meals, restaurants, cooking, and taste vocabulary.",
    difficulty_level: "A2",
    estimated_words_count: 50,
    color_code: "#EA580C",
  },
  {
    track_number: 2,
    track_name: "Real-World Communication",
    category_number: 9,
    category_name: "Travel & Transport",
    description: "Travel planning, routes, vehicles, and movement.",
    difficulty_level: "A2",
    estimated_words_count: 55,
    color_code: "#0284C7",
  },
  {
    track_number: 2,
    track_name: "Real-World Communication",
    category_number: 10,
    category_name: "Weather & Nature",
    description: "Weather, seasons, landscapes, and natural events.",
    difficulty_level: "A2",
    estimated_words_count: 45,
    color_code: "#0D9488",
  },
  {
    track_number: 3,
    track_name: "Work & Learning",
    category_number: 11,
    category_name: "School & Learning",
    description: "Vocabulary for study, practice, lessons, and education.",
    difficulty_level: "B1",
    estimated_words_count: 50,
    color_code: "#4F46E5",
  },
  {
    track_number: 3,
    track_name: "Work & Learning",
    category_number: 12,
    category_name: "Work & Business",
    description: "Workplace, meetings, business tasks, and professional terms.",
    difficulty_level: "B1",
    estimated_words_count: 55,
    color_code: "#334155",
  },
  {
    track_number: 3,
    track_name: "Work & Learning",
    category_number: 13,
    category_name: "Technology & Media",
    description: "Digital tools, media, communication, and online life.",
    difficulty_level: "B1",
    estimated_words_count: 60,
    color_code: "#9333EA",
  },
  {
    track_number: 4,
    track_name: "Practical Fluency",
    category_number: 14,
    category_name: "Health & Body",
    description: "Health, body, symptoms, appointments, and care.",
    difficulty_level: "B1",
    estimated_words_count: 50,
    color_code: "#DC2626",
  },
  {
    track_number: 4,
    track_name: "Practical Fluency",
    category_number: 15,
    category_name: "Culture & Entertainment",
    description: "Entertainment, hobbies, arts, media, and cultural topics.",
    difficulty_level: "B1",
    estimated_words_count: 50,
    color_code: "#CA8A04",
  },
  {
    track_number: 4,
    track_name: "Practical Fluency",
    category_number: 16,
    category_name: "Real-Life Problems",
    description: "Problems, solutions, delays, conflicts, and everyday issues.",
    difficulty_level: "B2",
    estimated_words_count: 50,
    color_code: "#BE123C",
  },
  {
    track_number: 4,
    track_name: "Practical Fluency",
    category_number: 17,
    category_name: "Social Skills",
    description: "Politeness, persuasion, disagreement, and relationship skills.",
    difficulty_level: "B2",
    estimated_words_count: 50,
    color_code: "#0F766E",
  },
  {
    track_number: 5,
    track_name: "Advanced Communication",
    category_number: 18,
    category_name: "Opinions & Ideas",
    description: "Expressing views, reasoning, arguments, and abstract ideas.",
    difficulty_level: "B2",
    estimated_words_count: 55,
    color_code: "#1D4ED8",
  },
  {
    track_number: 5,
    track_name: "Advanced Communication",
    category_number: 19,
    category_name: "Modern Life Topics",
    description: "Society, technology, lifestyle, news, and current issues.",
    difficulty_level: "B2",
    estimated_words_count: 55,
    color_code: "#7E22CE",
  },
  {
    track_number: 5,
    track_name: "Advanced Communication",
    category_number: 20,
    category_name: "Personal Growth",
    description: "Goals, mindset, improvement, discipline, and reflection.",
    difficulty_level: "B2",
    estimated_words_count: 50,
    color_code: "#15803D",
  },
  {
    track_number: 5,
    track_name: "Advanced Communication",
    category_number: 21,
    category_name: "Community & Society",
    description: "Civic life, communities, public issues, and social change.",
    difficulty_level: "C1",
    estimated_words_count: 60,
    color_code: "#B45309",
  },
  {
    track_number: 6,
    track_name: "Specialized Fluency",
    category_number: 22,
    category_name: "Advanced Conversation",
    description: "Nuanced phrases for fluent, flexible conversation.",
    difficulty_level: "C1",
    estimated_words_count: 60,
    color_code: "#2563EB",
  },
  {
    track_number: 6,
    track_name: "Specialized Fluency",
    category_number: 23,
    category_name: "Professional Mastery",
    description: "High-level workplace, leadership, and executive language.",
    difficulty_level: "C1",
    estimated_words_count: 60,
    color_code: "#475569",
  },
  {
    track_number: 6,
    track_name: "Specialized Fluency",
    category_number: 24,
    category_name: "Academic English",
    description: "Academic reading, writing, research, and formal argument.",
    difficulty_level: "C1",
    estimated_words_count: 65,
    color_code: "#6D28D9",
  },
  {
    track_number: 6,
    track_name: "Specialized Fluency",
    category_number: 25,
    category_name: "Specialized Fluency",
    description: "Domain-specific language for expert-level communication.",
    difficulty_level: "C2",
    estimated_words_count: 65,
    color_code: "#0F172A",
  },
];

const IMPROVE_SAMPLE: VocabularyLessonSample = {
  track: "Work & Learning",
  category: "School & Learning",
  word: "improve",
  pronunciation: "/ɪmˈpruːv/",
  word_type: "Verb",
  cefr_level: "B1",
  frequency: "High",
  english_meaning: "To make something better, or to become better.",
  tamil_meaning: "மேம்படுத்து / முன்னேறு / நல்லதாக மாறு",
  core_idea:
    "Something is not perfect now, but it becomes better than before. Tamil thinking: இப்போ இருக்குற level-ஐ விட நல்ல level-க்கு கொண்டு போவது.",
  memory_mastery: {
    memory_trigger: "improve = make better",
    visual_scene:
      "A student gets 50 marks first, then 75 marks. His score improves.",
    sound_association: "im-prove -> prove better என்று நினைக்கலாம்.",
    tamil_connection: "மேம்படுதல் / முன்னேற்றம்",
    emotional_hook: "You feel happy because your English is getting better.",
    memory_sentence: "I want to improve my English every day.",
    recall_question: "What word means make something better?",
    pattern_family:
      "improve + skill / improve + quality / improve + performance",
    notice: "Improve can mean make better or become better.",
  },
  meaning_expansion: {
    layer_1_literal:
      "To make a visible or practical thing better: We improved the room by adding lights.",
    layer_2_abstract:
      "To make ability, quality, or situation better: I want to improve my confidence.",
    layer_3_figurative:
      "Used for progress in life, mood, relationship, or image: His attitude has improved a lot.",
    layer_4_professional_technical:
      "To increase performance, efficiency, results, or quality: The company improved customer service.",
  },
  usage_mastery: {
    usage_profile: [
      { usage_area: "Literal", status: "Yes", example_sentence: "We improved the garden.", note: "Physical change is possible." },
      { usage_area: "Abstract", status: "Yes", example_sentence: "She improved her confidence.", note: "Very common." },
      { usage_area: "Figurative", status: "Limited", example_sentence: "His image improved after the interview.", note: "Natural in media or business." },
      { usage_area: "Everyday", status: "Yes", example_sentence: "My English is improving.", note: "Very common daily usage." },
      { usage_area: "Professional", status: "Yes", example_sentence: "We need to improve our process.", note: "Very useful at work." },
      { usage_area: "Technical", status: "Limited", example_sentence: "The update improved system speed.", note: "Used for technology and performance." },
      { usage_area: "Academic", status: "Yes", example_sentence: "The study aims to improve learning outcomes.", note: "Common in essays and research." },
      { usage_area: "Business", status: "Yes", example_sentence: "Sales improved this month.", note: "Very common." },
      { usage_area: "Formal", status: "Yes", example_sentence: "The policy improved public safety.", note: "Natural formal usage." },
      { usage_area: "Informal", status: "Yes", example_sentence: "Your cooking has improved!", note: "Natural casual usage." },
    ],
    word_usage_zone: {
      natural_zones: [
        "Skills",
        "Work",
        "Health",
        "Quality",
        "Results",
        "Professional Communication",
        "Everyday Conversation",
      ],
      limited_zones: ["Emotions", "Relationships"],
      unnatural_zones: ["Simple likes", "Taste adjectives without a noun"],
      short_explanation:
        "Improve needs a thing that can become better: skill, result, quality, situation, health, service, or performance.",
    },
    natural_domains: [
      "Education",
      "Workplace",
      "Business",
      "Health",
      "Personal Growth",
      "Technology",
      "Communication",
    ],
    domain_restrictions: {
      commonly_used: [
        "Improve English",
        "Improve communication",
        "Improve performance",
        "Improve quality",
        "Improve health",
        "Improve service",
        "Improve results",
      ],
      rarely_used: ["Improve a person directly"],
      not_normally_used: ["Directly with feelings like happy or sad"],
      unnatural_example: "I improved my lunch tasty.",
      natural_alternative:
        "I made my lunch tastier. / The taste of my lunch improved.",
      explanation:
        "Tamil speakers may use improve everywhere, but English uses it best with quality, skill, result, situation, health, and performance.",
    },
    context_switching_test: [
      {
        context: "English learning",
        natural: "Yes",
        example: "I want to improve my pronunciation.",
      },
      {
        context: "Business",
        natural: "Yes",
        example: "We improved our sales process.",
      },
      {
        context: "Health",
        natural: "Yes",
        example: "His health improved after treatment.",
      },
      {
        context: "Direct emotion adjective",
        natural: "No",
        example: "My happy improved.",
      },
    ],
    word_nature: "Mostly Abstract",
    word_nature_reason:
      "Improve usually talks about abstract things like skill, quality, health, performance, results, and confidence.",
    register: "Informal / Neutral / Formal / Professional / Academic",
    common_contexts: [
      "Daily conversation",
      "English learning",
      "Workplace meetings",
      "Performance reviews",
      "Health discussions",
      "Business reports",
      "Academic writing",
      "Self-development",
    ],
    tamil_usage_notes:
      "Avoid 'This class improved me.' Natural English: This class helped me improve.",
    when_to_use: [
      "skills: I want to improve my writing.",
      "health: Her health improved.",
      "work: We improved the process.",
      "results: My score improved.",
      "quality: The quality has improved.",
      "communication: He improved his presentation skills.",
    ],
    when_not_to_use: [
      "I improved my friend -> I helped my friend improve.",
      "The movie improved interesting -> The movie became more interesting.",
      "I improved happy -> I became happier.",
    ],
  },
  application: {
    examples: {
      Everyday: "My English is improving slowly.",
      Workplace: "We need to improve our communication.",
      Professional: "The team improved customer satisfaction.",
      Academic: "Reading regularly can improve vocabulary retention.",
      "Advanced Communication":
        "To improve long-term performance, we need better feedback systems.",
    },
    collocations: {
      strong: [
        "improve English",
        "improve skills",
        "improve quality",
        "improve performance",
        "improve communication",
        "improve health",
        "improve results",
        "improve confidence",
        "improve productivity",
      ],
      acceptable: [
        "improve mood",
        "improve design",
        "improve safety",
        "improve relationships",
        "improve understanding",
      ],
      unnatural: ["improve tasty", "improve happy", "improve beautiful", "improve me"],
      explanation: "Use improve + noun, not usually improve + adjective.",
    },
    native_usage_patterns: [
      "Something improves",
      "Improve something",
      "Help someone improve",
      "Improve by doing something",
      "Improve in an area",
    ],
    common_mistakes: [
      {
        incorrect: "My English improved very good.",
        correct: "My English improved a lot.",
        explanation: "Use a lot, not very good, after the verb.",
      },
      {
        incorrect: "This practice improved me.",
        correct: "This practice helped me improve.",
        explanation: "Improve usually needs a skill, quality, or result as object.",
      },
    ],
    confusion_zone:
      "Improve means become/make better. Develop means grow over time. Increase means become bigger in number. Upgrade means move to a better version. Enhance is more formal.",
    alternatives_synonyms: {
      near_synonyms: ["develop", "make better", "strengthen", "build up"],
      formal_alternatives: ["enhance", "refine", "optimize"],
      informal_alternatives: ["get better", "level up"],
      stronger_c1_c2_alternatives: [
        "refine",
        "enhance",
        "upgrade",
        "optimize",
        "strengthen",
      ],
      nuance:
        "Improve is the safest B1 word. Enhance is formal. Optimize sounds technical.",
    },
    frequency_by_context: [
      { context: "Daily Speech", frequency: "High" },
      { context: "Professional Communication", frequency: "High" },
      { context: "Academic Writing", frequency: "High" },
    ],
  },
  mastery: {
    mini_conversation:
      "A: How is your English practice going? B: It is going well. My speaking has improved a lot.",
    learn_the_pattern: [
      "I want to improve my + noun.",
      "My + noun + has improved.",
      "Something helped me improve.",
    ],
    guided_practice: [
      "Fill in: I want to ______ my English.",
      "Fill in: My confidence has ______ a lot.",
      "Correct: This class improved me.",
      "Write one sentence using improve about your English.",
    ],
    evaluation: [
      "What does improve mean?",
      "Write one sentence: improve + skill.",
      "Difference: improve vs increase.",
      "What do you want to improve this month?",
    ],
    feedback:
      "Check meaning, grammar, word choice, naturalness, register, and Tamil-speaker mistakes.",
    mastery_notes:
      "Native speakers think of progress when they hear improve. Avoid using improve directly with adjectives like happy, tasty, or beautiful.",
    native_thinking_model:
      "Native speakers think better quality, better skill, better result, better performance, and progress over time.",
  },
  sections: [
    { number: 1, title: "Basic Information", content: "Word: improve\nPronunciation: /ɪmˈpruːv/\nWord Type: Verb\nCEFR Level: B1\nFrequency: High" },
    { number: 2, title: "Meaning", content: "English Meaning: To make something better, or to become better.\nTamil Meaning: மேம்படுத்து / முன்னேறு / நல்லதாக மாறு\nCore Idea: Something is not perfect now, but it becomes better than before." },
    { number: 3, title: "Memory Mastery", content: "Memory Trigger: improve = make better\nVisual Scene: A student gets 50 marks first, then 75 marks.\nMemory Sentence: I want to improve my English every day.\nRecall Question: What word means make something better?" },
    { number: 4, title: "Meaning Expansion", content: "Layer 1 Literal: We improved the room by adding lights.\nLayer 2 Abstract: I want to improve my confidence.\nLayer 3 Figurative: His attitude has improved a lot.\nLayer 4 Professional / Technical: The company improved customer service." },
    { number: 5, title: "Usage Mastery", content: "Improve is natural in literal, abstract, everyday, professional, academic, business, formal, and informal use. Figurative and technical use are limited but natural in the right context." },
    { number: 6, title: "Word Usage Zone", content: "Natural Zones: Skills, Work, Health, Quality, Results.\nLimited Zones: Emotions, Relationships.\nUnnatural Zones: simple likes or taste adjectives." },
    { number: 7, title: "Natural Domains", content: ["Education", "Workplace", "Business", "Health", "Personal Growth", "Technology", "Communication"] },
    { number: 8, title: "Domain Restrictions", content: "Common: improve English, performance, quality, health, service.\nUnnatural: I improved my lunch tasty.\nNatural: I made my lunch tastier." },
    { number: 9, title: "Context Switching Test", content: "English learning: Yes. Business: Yes. Health: Yes. Food taste: Limited. Direct emotion adjective: No. Person directly: Limited." },
    { number: 10, title: "Word Nature", content: "Mostly Abstract. Improve usually talks about skill, quality, health, performance, results, and confidence." },
    { number: 11, title: "Register", content: "Informal: Yes. Neutral: Yes. Formal: Yes. Professional: Yes. Academic: Yes." },
    { number: 12, title: "Common Contexts", content: ["Daily conversation", "English learning", "Workplace meetings", "Performance reviews", "Health discussions", "Business reports", "Academic writing"] },
    { number: 13, title: "Tamil Usage Notes", content: "Incorrect: This class improved me.\nNatural: This class helped me improve.\nNatural: This class improved my confidence." },
    { number: 14, title: "When To Use", content: "Use improve for skills, health, work, results, quality, and communication." },
    { number: 15, title: "When NOT To Use", content: "Do not use improve directly with friend, interesting, happy, tasty, or beautiful. Use helped, became, made, or a noun phrase." },
    { number: 16, title: "Application", content: "Everyday: My English is improving slowly.\nWorkplace: We need to improve our communication.\nAcademic: Reading regularly can improve vocabulary retention." },
    { number: 17, title: "Collocations", content: "Strong: improve English, skills, quality, performance, communication, health, results, confidence.\nUnnatural: improve tasty, improve happy, improve beautiful, improve me." },
    { number: 18, title: "Native Usage Patterns", content: "Something improves. Improve something. Help someone improve. Improve by doing something. Improve in an area." },
    { number: 19, title: "Common Mistakes", content: "Incorrect: My English improved very good.\nCorrect: My English improved a lot.\nIncorrect: This practice improved me.\nCorrect: This practice helped me improve." },
    { number: 20, title: "Confusion Zone", content: "Improve = become/make better. Develop = grow/build over time. Increase = quantity only. Upgrade = better version. Enhance = more formal." },
    { number: 21, title: "Alternatives & Synonyms", content: "Near: develop, make better, strengthen.\nFormal: enhance, refine, optimize.\nInformal: get better, level up." },
    { number: 22, title: "Frequency By Context", content: "Daily Speech: High. Professional Communication: High. Academic Writing: High." },
    { number: 23, title: "Mini Conversation", content: "A: How is your English practice going?\nB: It is going well. My speaking has improved a lot." },
    { number: 24, title: "Learn The Pattern", content: "I want to improve my + noun.\nMy + noun + has improved.\nSomething helped me improve." },
    { number: 25, title: "Guided Practice", content: "I want to ______ my English.\nMy confidence has ______ a lot.\nCorrect: This class improved me.\nWrite one sentence using improve." },
    { number: 26, title: "Evaluation", content: "What does improve mean?\nWrite one sentence: improve + skill.\nDifference: improve vs increase.\nWhat do you want to improve this month?" },
    { number: 27, title: "Feedback", content: "Check meaning, grammar, word choice, naturalness, register, and Tamil-speaker mistakes." },
    { number: 28, title: "Mastery Notes", content: "Native speakers think of progress. Use improve for measurable or noticeable progress." },
    { number: 29, title: "Native Thinking Model", content: "Native speakers think better quality, better skill, better result, better performance, and progress over time. They do not usually think simple emotion adjectives." },
  ],
};

const usageAreas = [
  "Literal",
  "Abstract",
  "Figurative",
  "Everyday",
  "Professional",
  "Technical",
  "Academic",
  "Business",
  "Formal",
  "Informal",
];

function usageProfile(
  yesAreas: string[],
  limitedAreas: string[],
  word: string
): VocabularyLessonSample["usage_mastery"]["usage_profile"] {
  return usageAreas.map((usage_area) => {
    const status = yesAreas.includes(usage_area)
      ? "Yes"
      : limitedAreas.includes(usage_area)
        ? "Limited"
        : "No";

    return {
      usage_area,
      status,
      example_sentence:
        status === "No"
          ? "Not applicable"
          : `This is a natural ${usage_area.toLowerCase()} use of "${word}".`,
      note:
        status === "No"
          ? "This context is not natural for the word."
          : "Use it when the context matches the meaning and register.",
    };
  });
}

export const SAMPLE_VOCABULARY_LESSONS: VocabularyLessonSample[] = [
  IMPROVE_SAMPLE,
  {
    track: "Advanced Communication",
    category: "Opinions & Ideas",
    word: "amount to",
    pronunciation: "ə-ˈmau̇nt tə",
    word_type: "phrasal verb",
    cefr_level: "B2",
    frequency: "High",
    english_meaning:
      "To become equal to a total, result, meaning, or serious effect.",
    tamil_meaning:
      "மொத்தமாக ஆகிறது / ஒரு விளைவாக கருதப்படுகிறது",
    core_idea: "Something adds up to a total or has the effect of something.",
    memory_mastery: {
      memory_trigger: "Think of small parts adding up into one final result.",
      visual_scene:
        "Coins fall into a jar until the label changes to the final amount.",
      sound_association: "Amount sounds like a mountain of pieces becoming one total.",
      tamil_connection:
        "Tamil speakers may think of 'இதன் விளைவு' when it means consequence.",
      emotional_hook:
        "It is useful when you want to show that many small things become serious.",
      memory_sentence:
        "Small mistakes can amount to a big problem if nobody fixes them.",
      recall_question:
        "What do many small actions amount to when they create one result?",
      pattern_family: "amount to + noun/result/number",
      notice: "Never leave the object unclear; say what it amounts to.",
    },
    meaning_expansion: {
      layer_1_literal: "The bill amounts to $500.",
      layer_2_abstract: "His actions amount to fraud.",
      layer_3_figurative: "Not commonly used in this layer.",
      layer_4_professional_technical:
        "The evidence amounts to a regulatory violation.",
    },
    usage_mastery: {
      usage_profile: usageProfile(
        ["Literal", "Abstract", "Professional", "Academic", "Business", "Formal"],
        ["Everyday", "Technical", "Informal"],
        "amount to"
      ),
      word_usage_zone: {
        natural_zones: [
          "Abstract / Conceptual",
          "Business",
          "Professional Communication",
          "Academic Writing",
          "Legal",
          "Financial",
          "Formal Writing",
        ],
        limited_zones: ["Everyday Conversation", "Technical"],
        unnatural_zones: ["Emotional", "Human Relationships", "Informal Speech"],
        short_explanation:
          "It works best for totals, consequences, judgments, and formal conclusions.",
      },
      natural_domains: ["Finance", "Business Communication", "Legal Writing"],
      domain_restrictions: {
        commonly_used: ["Bills", "evidence", "business outcomes", "legal conclusions"],
        rarely_used: ["Food description", "casual compliments"],
        not_normally_used: ["Physical appearance", "simple emotions"],
        unnatural_example: "The soup amounts to tasty.",
        natural_alternative: "The soup tastes good.",
        explanation:
          "Use 'amount to' for totals or consequences, not for describing qualities.",
      },
      context_switching_test: [
        { context: "Finance", natural: "Yes", example: "The bill amounts to $500." },
        { context: "Business", natural: "Yes", example: "This amounts to a breach." },
        { context: "Education", natural: "Yes", example: "The mistakes amount to plagiarism." },
        { context: "Food Description", natural: "No", example: "The soup amounts to tasty." },
      ],
      word_nature: "Abstract + Tangible",
      word_nature_reason:
        "It can describe numerical totals and abstract consequences.",
      register: "Neutral / Formal / Professional / Academic",
      common_contexts: ["Reports", "Meetings", "Finance", "Academic Writing"],
      tamil_usage_notes:
        "Do not translate every 'ஆகிறது' as 'amount to'; use it only for totals or consequences.",
      when_to_use: [
        "When numbers form a total",
        "When actions create a serious result",
        "When explaining formal consequences",
      ],
      when_not_to_use: [
        "For taste or appearance",
        "For simple feelings",
        "When 'become' or 'mean' is more natural",
      ],
    },
    application: {
      examples: {
        Everyday: "All these small costs amount to a lot by the end of the month.",
        Workplace: "Repeated delays amount to a planning problem.",
        Professional: "This behavior amounts to a breach of policy.",
        Academic: "The evidence amounts to a strong argument for reform.",
        "Advanced Communication":
          "Taken together, these decisions amount to a change in strategy.",
      },
      collocations: {
        strong: ["amount to fraud", "amount to a breach", "amount to $500"],
        acceptable: ["amount to a problem", "amount to evidence"],
        unnatural: ["amount to beautiful", "amount to hungry"],
        explanation:
          "The phrase pairs with totals, results, violations, evidence, and conclusions.",
      },
      native_usage_patterns: [
        "This amounts to + noun",
        "Taken together, these + plural noun + amount to + result",
        "The total amounts to + number",
      ],
      common_mistakes: [
        {
          incorrect: "The food amounts to delicious.",
          correct: "The food is delicious.",
          explanation: "Use adjectives directly; 'amount to' needs a result or total.",
        },
      ],
      confusion_zone:
        "'Amount to' is close to 'equal' for totals and 'constitute' for formal meaning, but it is not a general replacement for 'become'.",
      alternatives_synonyms: {
        near_synonyms: ["equal", "add up to", "come to"],
        formal_alternatives: ["constitute", "represent"],
        informal_alternatives: ["add up to"],
        stronger_c1_c2_alternatives: ["constitute", "culminate in"],
        nuance: "'Constitute' sounds more formal; 'add up to' sounds more everyday.",
      },
      frequency_by_context: [
        { context: "Daily Speech", frequency: "Medium" },
        { context: "Professional Communication", frequency: "High" },
        { context: "Academic Writing", frequency: "High" },
      ],
    },
    mastery: {
      mini_conversation:
        "A: Is this just a small delay? B: No, repeated delays amount to a serious delivery risk.",
      learn_the_pattern: [
        "This amounts to + result",
        "The total amounts to + number",
        "These actions amount to + consequence",
      ],
      guided_practice: [
        "Fill in: The total ___ $500.",
        "Fill in: His actions amount ___ a breach.",
        "Correct: The soup amounts to tasty.",
        "Create one professional sentence using 'amount to'.",
      ],
      evaluation: [
        "What does 'amount to' mean in finance?",
        "Create one business example.",
        "Compare 'amount to' and 'become'.",
        "When should you avoid this phrase?",
      ],
      feedback:
        "Check meaning, grammar, word choice, naturalness, and register before marking it mastered.",
      mastery_notes:
        "Native speakers hear a total, result, or serious conclusion. They do not hear taste, beauty, or simple emotion.",
      native_thinking_model:
        "Native speakers connect this phrase with accumulation, consequence, and judgment; they do not connect it with ordinary adjective descriptions.",
    },
  },
  {
    track: "Advanced Communication",
    category: "Modern Life Topics",
    word: "trade-off",
    pronunciation: "ˈtrād-ˌȯf",
    word_type: "noun",
    cefr_level: "B2",
    frequency: "High",
    english_meaning:
      "A situation where you gain one thing but lose or accept less of another.",
    tamil_meaning:
      "ஒரு நன்மைக்காக மற்றொரு விஷயத்தை விட்டுக்கொடுக்கும் சமநிலை",
    core_idea: "Choosing one benefit usually means accepting one cost.",
    memory_mastery: {
      memory_trigger: "Imagine a scale: one side goes up, the other goes down.",
      visual_scene:
        "A person chooses speed on one side and quality drops on the other side.",
      sound_association: "Trade reminds you that something is exchanged.",
      tamil_connection:
        "Tamil speakers can think of 'சலுகை - இழப்பு சமநிலை'.",
      emotional_hook:
        "It helps explain difficult decisions without sounding emotional.",
      memory_sentence:
        "There is a trade-off between saving money and saving time.",
      recall_question: "What do you lose when you gain something else?",
      pattern_family: "trade-off between A and B",
      notice: "Use 'between' when naming the two sides.",
    },
    meaning_expansion: {
      layer_1_literal: "Not commonly used in this layer.",
      layer_2_abstract: "There is a trade-off between freedom and security.",
      layer_3_figurative: "Not commonly used in this layer.",
      layer_4_professional_technical:
        "The design creates a trade-off between performance and battery life.",
    },
    usage_mastery: {
      usage_profile: usageProfile(
        ["Abstract", "Everyday", "Professional", "Technical", "Academic", "Business", "Formal"],
        ["Informal"],
        "trade-off"
      ),
      word_usage_zone: {
        natural_zones: [
          "Abstract / Conceptual",
          "Business",
          "Professional Communication",
          "Academic Writing",
          "Technical",
          "Strategic / Management",
          "Everyday Conversation",
        ],
        limited_zones: ["Informal Speech"],
        unnatural_zones: ["Physical / Tangible", "Emotional"],
        short_explanation:
          "It is natural when comparing benefits and costs in a decision.",
      },
      natural_domains: ["Technology", "Business", "Personal Growth"],
      domain_restrictions: {
        commonly_used: ["Product decisions", "time management", "strategy", "policy"],
        rarely_used: ["Simple greetings", "direct emotions"],
        not_normally_used: ["Physical object descriptions"],
        unnatural_example: "This chair is a trade-off.",
        natural_alternative:
          "Choosing this chair is a trade-off between comfort and price.",
        explanation:
          "The word describes a decision relationship, not an object by itself.",
      },
      context_switching_test: [
        { context: "Technology", natural: "Yes", example: "There is a trade-off between speed and battery life." },
        { context: "Business", natural: "Yes", example: "The plan involves a trade-off between cost and quality." },
        { context: "Daily Life", natural: "Yes", example: "Living far away is a trade-off: cheaper rent, longer travel." },
        { context: "Object Description", natural: "No", example: "My phone is trade-off." },
      ],
      word_nature: "Abstract Only",
      word_nature_reason:
        "It describes a relationship between choices, not a physical thing.",
      register: "Neutral / Professional / Academic",
      common_contexts: ["Planning", "Design", "Business", "Personal Decisions"],
      tamil_usage_notes:
        "Avoid translating it as only 'வியாபாரம்'; here 'trade' means exchange between benefits and costs.",
      when_to_use: [
        "When comparing two competing benefits",
        "When explaining a decision cost",
        "When discussing strategy or design",
      ],
      when_not_to_use: [
        "For a single object without comparison",
        "For greetings",
        "When there is no loss or cost",
      ],
    },
    application: {
      examples: {
        Everyday: "Working late has a trade-off: more money but less family time.",
        Workplace: "There is a trade-off between speed and accuracy.",
        Professional: "The proposal accepts a trade-off between cost and reliability.",
        Academic: "Policy decisions often involve trade-offs between growth and equality.",
        "Advanced Communication":
          "The real trade-off is not price versus quality, but control versus flexibility.",
      },
      collocations: {
        strong: ["clear trade-off", "difficult trade-off", "trade-off between"],
        acceptable: ["major trade-off", "reasonable trade-off"],
        unnatural: ["trade-off beautiful", "eat a trade-off"],
        explanation:
          "It naturally combines with decision adjectives and 'between A and B'.",
      },
      native_usage_patterns: [
        "There is a trade-off between A and B",
        "The trade-off is that + clause",
        "This creates a trade-off",
      ],
      common_mistakes: [
        {
          incorrect: "This is trade-off between speed and quality.",
          correct: "This is a trade-off between speed and quality.",
          explanation: "Use the article 'a' before the singular noun.",
        },
      ],
      confusion_zone:
        "'Trade-off' is not the same as 'compromise'. A compromise is an agreement; a trade-off is a cost-benefit relationship.",
      alternatives_synonyms: {
        near_synonyms: ["compromise", "balance", "exchange"],
        formal_alternatives: ["cost-benefit balance"],
        informal_alternatives: ["give-and-take"],
        stronger_c1_c2_alternatives: ["opportunity cost", "strategic compromise"],
        nuance:
          "'Opportunity cost' is more economic; 'give-and-take' is more conversational.",
      },
      frequency_by_context: [
        { context: "Daily Speech", frequency: "Medium" },
        { context: "Professional Communication", frequency: "High" },
        { context: "Academic Writing", frequency: "High" },
      ],
    },
    mastery: {
      mini_conversation:
        "A: Should we launch faster? B: Maybe, but the trade-off is lower testing quality.",
      learn_the_pattern: [
        "There is a trade-off between A and B",
        "The trade-off is that + sentence",
        "Choosing A means accepting B",
      ],
      guided_practice: [
        "Fill in: There is a trade-off ___ cost and quality.",
        "Fill in: The trade-off ___ less flexibility.",
        "Correct: This is trade-off between time and money.",
        "Create one sentence about your own study routine.",
      ],
      evaluation: [
        "What does 'trade-off' mean?",
        "Give one workplace example.",
        "Compare 'trade-off' and 'compromise'.",
        "Name one unnatural use.",
      ],
      feedback:
        "Check whether the sentence clearly shows both the benefit and the cost.",
      mastery_notes:
        "Native speakers think of decision pressure, balance, and accepted cost.",
      native_thinking_model:
        "The word activates a mental scale: gaining one side means giving up something on the other side.",
    },
  },
  {
    track: "Practical Fluency",
    category: "Real-Life Problems",
    word: "bottleneck",
    pronunciation: "ˈbä-tᵊl-ˌnek",
    word_type: "noun",
    cefr_level: "B2",
    frequency: "Medium",
    english_meaning:
      "A point in a process where progress slows down because too much is waiting there.",
    tamil_meaning:
      "செயல்முறையை மெதுவாக்கும் நெருக்கடி பகுதி / தடுப்பு இடம்",
    core_idea: "A narrow point slows the whole flow.",
    memory_mastery: {
      memory_trigger: "Think of water stuck at the narrow neck of a bottle.",
      visual_scene:
        "A road narrows from four lanes to one lane and traffic slows down.",
      sound_association: "Bottle neck is literally the narrow part of a bottle.",
      tamil_connection:
        "Tamil speakers can connect it to 'நெரிசல் ஏற்படும் இடம்'.",
      emotional_hook:
        "It helps explain why a whole team slows down even when most people work hard.",
      memory_sentence:
        "Approval is the bottleneck in our hiring process.",
      recall_question: "Where does a process slow down?",
      pattern_family: "X is the bottleneck / bottleneck in + process",
      notice: "Use it for a process, system, road, queue, or workflow.",
    },
    meaning_expansion: {
      layer_1_literal: "The bottleneck of the bottle is narrow.",
      layer_2_abstract: "Manual approval is the bottleneck in the process.",
      layer_3_figurative: "The manager became the bottleneck for every decision.",
      layer_4_professional_technical:
        "Database writes are the bottleneck in the application architecture.",
    },
    usage_mastery: {
      usage_profile: usageProfile(
        ["Literal", "Abstract", "Figurative", "Professional", "Technical", "Business"],
        ["Everyday", "Academic", "Formal", "Informal"],
        "bottleneck"
      ),
      word_usage_zone: {
        natural_zones: [
          "Physical / Tangible",
          "Abstract / Conceptual",
          "Business",
          "Professional Communication",
          "Technical",
          "Strategic / Management",
        ],
        limited_zones: ["Everyday Conversation", "Formal Writing"],
        unnatural_zones: ["Emotional", "Human Relationships"],
        short_explanation:
          "It is natural when something narrows, blocks, or slows a flow.",
      },
      natural_domains: ["Operations", "Technology", "Project Management"],
      domain_restrictions: {
        commonly_used: ["Traffic", "workflows", "systems", "approval processes"],
        rarely_used: ["Romantic relationships", "food taste"],
        not_normally_used: ["Simple personality description"],
        unnatural_example: "He is bottleneck happy.",
        natural_alternative: "He is blocking the process.",
        explanation:
          "Use it for slow points in a flow, not as a general adjective.",
      },
      context_switching_test: [
        { context: "Traffic", natural: "Yes", example: "The bridge is a bottleneck during rush hour." },
        { context: "Technology", natural: "Yes", example: "The database is the bottleneck." },
        { context: "Project Management", natural: "Yes", example: "Review is our bottleneck." },
        { context: "Emotion", natural: "No", example: "I feel bottleneck today." },
      ],
      word_nature: "Abstract + Tangible",
      word_nature_reason:
        "It can describe a physical narrow place or an abstract process delay.",
      register: "Neutral / Professional / Technical",
      common_contexts: ["Operations", "Meetings", "Tech Systems", "Traffic"],
      tamil_usage_notes:
        "Do not use it for every problem; use it only when one point slows the whole process.",
      when_to_use: [
        "When one step slows a process",
        "When capacity is too low at one point",
        "When diagnosing workflow problems",
      ],
      when_not_to_use: [
        "For general sadness",
        "For taste",
        "For a problem with no flow or process",
      ],
    },
    application: {
      examples: {
        Everyday: "The narrow street is a bottleneck every morning.",
        Workplace: "Manager approval is the bottleneck in this process.",
        Professional: "We need to remove the onboarding bottleneck.",
        Academic: "Limited infrastructure can become a bottleneck for growth.",
        "Advanced Communication":
          "The bottleneck is not effort; it is decision-making capacity.",
      },
      collocations: {
        strong: ["major bottleneck", "approval bottleneck", "remove a bottleneck"],
        acceptable: ["clear bottleneck", "technical bottleneck"],
        unnatural: ["bottleneck tasty", "feel bottleneck"],
        explanation:
          "It naturally combines with process, workflow, and capacity language.",
      },
      native_usage_patterns: [
        "X is the bottleneck",
        "There is a bottleneck in + process",
        "Remove / identify / create a bottleneck",
      ],
      common_mistakes: [
        {
          incorrect: "I am bottleneck.",
          correct: "I am the bottleneck in this process.",
          explanation: "Use it as a noun and explain the process it affects.",
        },
      ],
      confusion_zone:
        "'Bottleneck' is a slow point. 'Obstacle' is any block. 'Delay' is the result of slowness.",
      alternatives_synonyms: {
        near_synonyms: ["blockage", "slow point", "constraint"],
        formal_alternatives: ["constraint", "capacity limitation"],
        informal_alternatives: ["slow spot", "hold-up"],
        stronger_c1_c2_alternatives: ["systemic constraint", "throughput limitation"],
        nuance:
          "'Constraint' is broader; 'bottleneck' strongly suggests flow is slowed at one narrow point.",
      },
      frequency_by_context: [
        { context: "Daily Speech", frequency: "Medium" },
        { context: "Professional Communication", frequency: "High" },
        { context: "Academic Writing", frequency: "Medium" },
      ],
    },
    mastery: {
      mini_conversation:
        "A: Why is the project slow? B: Legal review is the bottleneck.",
      learn_the_pattern: [
        "X is the bottleneck",
        "There is a bottleneck in + process",
        "We need to remove the bottleneck",
      ],
      guided_practice: [
        "Fill in: Approval is the ___ in our process.",
        "Fill in: There is a bottleneck ___ the workflow.",
        "Correct: I feel bottleneck today.",
        "Create one sentence about a traffic or work problem.",
      ],
      evaluation: [
        "What is a bottleneck?",
        "Give one technology example.",
        "Compare 'bottleneck' and 'obstacle'.",
        "When is this word unnatural?",
      ],
      feedback:
        "Check whether the sentence names the slow point and the larger process.",
      mastery_notes:
        "Native speakers think of flow, capacity, and one slow point affecting the whole system.",
      native_thinking_model:
        "The word brings up a narrow point in a process; it does not mean any random problem or emotion.",
    },
  },
];

export function getSampleLessons(words?: string[]): VocabularyLessonSample[] {
  if (!words?.length) {
    return SAMPLE_VOCABULARY_LESSONS;
  }

  const normalized = words.map((word) => word.trim().toLowerCase());
  const matches = SAMPLE_VOCABULARY_LESSONS.filter((lesson) =>
    normalized.includes(lesson.word.toLowerCase())
  );

  if (matches.length > 0) {
    return matches;
  }

  return SAMPLE_VOCABULARY_LESSONS.slice(0, Math.min(words.length, 3));
}
