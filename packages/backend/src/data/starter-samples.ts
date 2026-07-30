export interface StarterSample {
  word: string;
  canonicalKey: string;
  pronunciation: string;
  wordType: string;
  itemType: string;
  cefrLevel: "B2" | "C1" | "C2";
  frequency: "Heavy" | "Medium";
  categoryName: string;
  englishMeaning: string;
  tamilMeaning: string;
  coreIdea: string;
  lesson: Record<string, unknown>;
}

function lesson(input: {
  memoryTrigger: string;
  visualScene: string;
  tamilConnection: string;
  memorySentence: string;
  recallQuestion: string;
  naturalZones: string[];
  limitedZones: string[];
  whenToUse: string[];
  whenNotToUse: string[];
  examples: Record<string, string>;
  collocations: string[];
  commonMistake: string;
  confusion: string;
  miniConversation: string;
  guidedPractice: string[];
}) {
  return {
    sample_notice:
      "Built-in starter sample. You can remove the complete starter set without affecting your own vocabulary.",
    memory_mastery: {
      memory_trigger: input.memoryTrigger,
      visual_scene: input.visualScene,
      tamil_connection: input.tamilConnection,
      memory_sentence: input.memorySentence,
      recall_question: input.recallQuestion,
      emotional_hook: "Connect the expression to a situation you have experienced.",
      pattern_family: "Meaning → situation → natural sentence",
    },
    meaning_expansion: {
      layer_1_literal: "The direct meaning used in the example context.",
      layer_2_abstract:
        "The broader idea the speaker communicates in conversation or writing.",
      layer_3_figurative: "Use depends on the expression and its context.",
      layer_4_professional_technical:
        "Suitable when the register and situation shown below match.",
    },
    usage_mastery: {
      usage_profile: {
        everyday: "Yes",
        professional: "Yes, when contextually suitable",
        academic: "Varies by expression",
        formal: "Varies by expression",
      },
      word_usage_zone: {
        natural_zones: input.naturalZones,
        limited_zones: input.limitedZones,
        unnatural_zones: ["Situations where a simpler expression is clearer"],
        short_explanation:
          "Choose this expression when its meaning and register fit the situation.",
      },
      tamil_usage_notes:
        "தமிழில் உள்ள எண்ணத்தை அப்படியே word-by-word மொழிபெயர்க்காமல், இந்த English pattern-ஐ முழுமையாக நினைவில் கொள்ளுங்கள்.",
      when_to_use: input.whenToUse,
      when_not_to_use: input.whenNotToUse,
      register: "See the contextual guidance and examples.",
      common_contexts: input.naturalZones,
    },
    application: {
      examples: input.examples,
      collocations: input.collocations,
      native_usage_patterns:
        "Notice the complete pattern, then replace only the situation-specific part.",
      common_mistakes: [
        {
          mistake: input.commonMistake,
          correction: "Use the complete expression and match its grammar.",
        },
      ],
      confusion_zone: input.confusion,
      alternatives_synonyms: [],
    },
    mastery: {
      mini_conversation: input.miniConversation,
      guided_practice: input.guidedPractice,
      evaluation: [
        "Explain the meaning without translating word by word.",
        "Create one natural personal example.",
      ],
      feedback:
        "Check meaning, grammar, naturalness, register and the complete pattern.",
      mastery_notes:
        "The sample is mastered when you can recall and use it naturally in a new context.",
      native_thinking_model:
        "Think of the situation first; retrieve the whole English expression next.",
    },
  };
}

export const STARTER_SAMPLES: StarterSample[] = [
  {
    word: "straightforward",
    canonicalKey: "straightforward|adjective",
    pronunciation: "/ˌstreɪtˈfɔːrwərd/",
    wordType: "Adjective",
    itemType: "word",
    cefrLevel: "B2",
    frequency: "Heavy",
    categoryName: "Daily Life",
    englishMeaning: "Easy to understand or do; honest and direct.",
    tamilMeaning: "எளிதாகப் புரியக்கூடிய / நேரடியான",
    coreIdea: "There is no unnecessary difficulty, complexity or hidden meaning.",
    lesson: lesson({
      memoryTrigger: "A straight road with no confusing turns.",
      visualScene: "You open clear instructions and finish the task immediately.",
      tamilConnection: "சிக்கல் இல்லாமல் நேராகவும் தெளிவாகவும் இருப்பது.",
      memorySentence: "The application process was surprisingly straightforward.",
      recallQuestion: "Which adjective means clear, direct and not complicated?",
      naturalZones: ["instructions", "processes", "explanations", "people"],
      limitedZones: ["highly emotional situations"],
      whenToUse: [
        "Use it for something clear and uncomplicated.",
        "Use it for a person who communicates honestly and directly.",
      ],
      whenNotToUse: ["Do not assume it always means physically straight."],
      examples: {
        everyday: "The instructions are straightforward.",
        professional: "The migration should be straightforward.",
        person: "She was straightforward about the problem.",
      },
      collocations: [
        "straightforward process",
        "straightforward explanation",
        "fairly straightforward",
      ],
      commonMistake: "Using straight when straightforward is needed.",
      confusion:
        "Simple emphasizes low difficulty; straightforward also suggests clarity or directness.",
      miniConversation:
        "A: Is the setup difficult?\nB: No, it is quite straightforward.",
      guidedPractice: [
        "Describe a clear procedure using straightforward.",
        "Describe an honest person using straightforward.",
      ],
    }),
  },
  {
    word: "come to terms with",
    canonicalKey: "come to terms with|expression",
    pronunciation: "/kʌm tə tɜːrmz wɪð/",
    wordType: "Expression",
    itemType: "phrasal expression",
    cefrLevel: "C1",
    frequency: "Heavy",
    categoryName: "Emotions & Personality",
    englishMeaning:
      "To gradually accept a difficult, painful or unwanted reality.",
    tamilMeaning: "கடினமான உண்மையை படிப்படியாக ஏற்றுக்கொள்",
    coreIdea:
      "The reality has not changed, but your mind gradually stops resisting it.",
    lesson: lesson({
      memoryTrigger: "Your hands slowly release a rope you cannot keep pulling.",
      visualScene:
        "Someone reads disappointing news, pauses, and begins planning what to do next.",
      tamilConnection:
        "மாற்ற முடியாத ஒரு கடினமான உண்மையை மனதளவில் ஏற்றுக்கொள்வது.",
      memorySentence: "It took me time to come to terms with the change.",
      recallQuestion:
        "Which expression means gradually accepting a painful reality?",
      naturalZones: ["loss", "change", "failure", "diagnosis", "limitations"],
      limitedZones: ["small everyday preferences"],
      whenToUse: [
        "Use it when acceptance is emotionally or mentally difficult.",
      ],
      whenNotToUse: [
        "Do not use it for quickly agreeing to ordinary conditions or prices.",
      ],
      examples: {
        personal: "She is still coming to terms with the result.",
        professional: "The team had to come to terms with the reduced budget.",
        reflective: "I finally came to terms with what had happened.",
      },
      collocations: [
        "struggle to come to terms with",
        "slowly come to terms with",
        "come to terms with reality",
      ],
      commonMistake: "Saying come into terms with.",
      confusion:
        "Accept can be immediate and neutral; come to terms with emphasizes a gradual, difficult emotional process.",
      miniConversation:
        "A: How is he handling the decision?\nB: He is slowly coming to terms with it.",
      guidedPractice: [
        "Describe a change that took time to accept.",
        "Contrast accept with come to terms with.",
      ],
    }),
  },
  {
    word: "a compelling argument",
    canonicalKey: "a compelling argument|collocation",
    pronunciation: "/ə kəmˈpelɪŋ ˈɑːrɡjəmənt/",
    wordType: "Collocation",
    itemType: "collocation",
    cefrLevel: "C1",
    frequency: "Medium",
    categoryName: "Academic English",
    englishMeaning:
      "A line of reasoning that is convincing and strongly holds attention.",
    tamilMeaning: "மிகவும் நம்ப வைக்கும் வாதம்",
    coreIdea:
      "The reasons and evidence are strong enough to make an idea difficult to dismiss.",
    lesson: lesson({
      memoryTrigger: "Evidence pulling an undecided listener toward one side.",
      visualScene:
        "A presenter connects clear evidence until the audience nods in agreement.",
      tamilConnection: "ஆதாரங்களால் மிகவும் நம்ப வைக்கும் வாதம்.",
      memorySentence: "The report makes a compelling argument for early action.",
      recallQuestion:
        "Which collocation describes a strongly convincing line of reasoning?",
      naturalZones: ["essays", "reports", "debates", "proposals", "reviews"],
      limitedZones: ["very casual conversation"],
      whenToUse: [
        "Use it to evaluate reasoning supported by convincing evidence.",
      ],
      whenNotToUse: [
        "Do not use compelling merely because you personally like the conclusion.",
      ],
      examples: {
        academic: "The author presents a compelling argument for reform.",
        business: "She made a compelling argument for investing now.",
        critical: "It is interesting, but not yet a compelling argument.",
      },
      collocations: [
        "make a compelling argument",
        "present a compelling argument",
        "compelling argument for/against",
      ],
      commonMistake: "Using strong argument in every formal context.",
      confusion:
        "A valid argument is logically sound; a compelling argument is strongly convincing.",
      miniConversation:
        "A: Did the proposal persuade you?\nB: Yes, it made a compelling argument for the change.",
      guidedPractice: [
        "Make a compelling argument for one useful habit.",
        "Explain why evidence can make an argument compelling.",
      ],
    }),
  },
  {
    word: "to no avail",
    canonicalKey: "to no avail|idiom",
    pronunciation: "/tə nəʊ əˈveɪl/",
    wordType: "Idiom",
    itemType: "idiom",
    cefrLevel: "C2",
    frequency: "Medium",
    categoryName: "Advanced Conversation",
    englishMeaning: "Without achieving the intended result.",
    tamilMeaning: "எந்தப் பயனும் இல்லாமல் / பலனின்றி",
    coreIdea: "An effort was made, but it produced no useful result.",
    lesson: lesson({
      memoryTrigger: "A key turns repeatedly, but the locked door never opens.",
      visualScene: "You try several solutions, yet the same error remains.",
      tamilConnection: "முயற்சி செய்தும் எந்தப் பலனும் கிடைக்காத நிலை.",
      memorySentence: "We restarted the service several times, but to no avail.",
      recallQuestion: "Which idiom means that an effort produced no result?",
      naturalZones: ["narratives", "reports", "formal conversation", "journalism"],
      limitedZones: ["very informal everyday speech"],
      whenToUse: [
        "Use it after describing an unsuccessful effort or several attempts.",
      ],
      whenNotToUse: [
        "Avoid it when the attempt achieved even a meaningful partial result.",
      ],
      examples: {
        narrative: "They searched throughout the night, but to no avail.",
        professional:
          "The team attempted to reproduce the defect, initially to no avail.",
        personal: "I called several times, but to no avail.",
      },
      collocations: [
        "try to no avail",
        "search to no avail",
        "but to no avail",
      ],
      commonMistake: "Saying with no avail.",
      confusion:
        "In vain has nearly the same meaning; to no avail often sounds slightly more formal.",
      miniConversation:
        "A: Did restarting it fix the problem?\nB: I tried twice, but to no avail.",
      guidedPractice: [
        "Describe an unsuccessful attempt using but to no avail.",
        "Replace without success with to no avail.",
      ],
    }),
  },
];

export const STARTER_SAMPLE_KEYS = STARTER_SAMPLES.map(
  (sample) => sample.canonicalKey,
);
