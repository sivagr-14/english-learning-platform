export const STARTER_SAMPLE_VERSION = 2;

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

interface LessonInput {
  meaningType: string;
  connotation: string;
  tone: string;
  register: string;
  sourceSentence: string;
  contextualMeaning: string;
  usageNote: string;
  whenToUse: string[];
  whenNotToUse: string[];
  mainPattern: string;
  collocations: string[];
  examples: Record<string, string>;
  miniConversation: string;
  commonMistake: string;
  correction: string;
  importantDifference: string;
  memoryTrigger: string;
  memorySentence: string;
  recallQuestion: string;
  recognitionTask: string;
  productionTask: string;
  advancedNuance?: string[];
}

function lesson(input: LessonInput) {
  return {
    format_version: "simplified-v1",
    sample_version: STARTER_SAMPLE_VERSION,
    sample_notice:
      "Built-in starter sample. Refreshing the starter set updates this lesson without changing your progress.",
    overview: {
      meaning_usage_profile: {
        meaning_type: input.meaningType,
        connotation: input.connotation,
        tone: input.tone,
        register: input.register,
      },
    },
    meaning_in_context: {
      source_sentence: input.sourceSentence,
      contextual_meaning: input.contextualMeaning,
      simple_explanation: input.usageNote,
    },
    usage_guide: {
      when_to_use: input.whenToUse,
      when_not_to_use: input.whenNotToUse,
    },
    patterns_collocations: {
      main_pattern: input.mainPattern,
      common_collocations: input.collocations,
    },
    natural_examples: {
      examples: input.examples,
      mini_conversation: input.miniConversation,
    },
    mistakes_differences: {
      common_mistake: input.commonMistake,
      correction: input.correction,
      important_difference: input.importantDifference,
    },
    memory_practice: {
      memory_trigger: input.memoryTrigger,
      memory_sentence: input.memorySentence,
      recall_question: input.recallQuestion,
      recognition_task: input.recognitionTask,
      production_task: input.productionTask,
    },
    ...(input.advancedNuance?.length
      ? { advanced_nuance: input.advancedNuance }
      : {}),
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
    coreIdea:
      "There is no unnecessary difficulty, complexity or hidden meaning.",
    lesson: lesson({
      meaningType: "Literal and abstract",
      connotation: "Usually positive or neutral",
      tone: "Clear and direct",
      register: "Neutral; natural in everyday and professional English",
      sourceSentence:
        "The application process was surprisingly straightforward.",
      contextualMeaning:
        "The process was clear and easy to complete, without unnecessary difficulty.",
      usageNote:
        "It can describe a clear task or explanation, or a person who communicates honestly and directly.",
      whenToUse: [
        "Use it for a process, instruction or explanation that is clear and uncomplicated.",
        "Use it for a person or answer that is honest and direct.",
      ],
      whenNotToUse: ["Do not use it merely to mean physically straight."],
      mainPattern:
        "be + straightforward; a straightforward + noun; be straightforward about + noun",
      collocations: [
        "straightforward process",
        "straightforward explanation",
        "fairly straightforward",
        "be straightforward about something",
      ],
      examples: {
        everyday: "The instructions are straightforward.",
        professional: "The migration should be straightforward.",
        person: "She was straightforward about the problem.",
      },
      miniConversation:
        "A: Is the setup difficult?\nB: No, it is quite straightforward.",
      commonMistake: "Using straight when straightforward is needed.",
      correction:
        "Say “The instructions are straightforward,” not “The instructions are straight.”",
      importantDifference:
        "Simple emphasizes low difficulty; straightforward also suggests clarity or directness.",
      memoryTrigger: "Picture a straight road with no confusing turns.",
      memorySentence:
        "The application process was surprisingly straightforward.",
      recallQuestion:
        "Which adjective means clear, direct and not complicated?",
      recognitionTask:
        "Choose the natural use: “a straightforward explanation” or “a straightforward road.”",
      productionTask:
        "Describe one clear process and one honest person using straightforward.",
      advancedNuance: [
        "When it describes a person, straightforward can sound approving, but in a sensitive situation it may imply bluntness.",
      ],
    }),
  },
  {
    word: "come to terms with",
    canonicalKey: "come to terms with|expression",
    pronunciation: "/kʌm tə tɜːmz wɪð/",
    wordType: "Expression",
    itemType: "phrasal expression",
    cefrLevel: "C1",
    frequency: "Heavy",
    categoryName: "Emotions & Personality",
    englishMeaning:
      "To gradually accept and emotionally deal with a difficult reality.",
    tamilMeaning:
      "ஒரு கடினமான உண்மையை மனதளவில் ஏற்றுக்கொண்டு சமாளிக்கத் தொடங்குதல்",
    coreIdea: "Difficult reality → emotional struggle → gradual acceptance.",
    lesson: lesson({
      meaningType: "Figurative, idiomatic and abstract",
      connotation:
        "Neutral, but normally associated with difficult experiences",
      tone: "Serious, reflective or empathetic",
      register:
        "Neutral; suitable for everyday, professional and formal English",
      sourceSentence:
        "She is still trying to come to terms with the loss of her job.",
      contextualMeaning:
        "She knows she has lost her job, but she is still learning to accept it emotionally.",
      usageNote:
        "It describes a gradual emotional process. It does not mean the person likes the situation or has fully recovered.",
      whenToUse: [
        "Use it for accepting a loss, illness, failure, major change or difficult truth.",
        "Use it when acceptance requires real emotional or mental adjustment.",
      ],
      whenNotToUse: [
        "Avoid it for trivial facts or ordinary arrangements that require no emotional acceptance.",
      ],
      mainPattern: "come to terms with + noun / noun phrase / the fact that…",
      collocations: [
        "come to terms with a loss",
        "come to terms with reality",
        "come to terms with the diagnosis",
        "struggle to come to terms with",
        "find it difficult to come to terms with",
      ],
      examples: {
        everyday:
          "It took him several months to come to terms with the end of the relationship.",
        professional:
          "The company must come to terms with the fact that customer expectations have changed.",
        reflection:
          "I have finally come to terms with the mistakes I made in the past.",
      },
      miniConversation:
        "A: How is Maya coping with the news?\nB: She understands what happened, but she hasn’t fully come to terms with it yet.",
      commonMistake: "She came into terms with the decision.",
      correction: "She came to terms with the decision.",
      importantDifference:
        "Accept can describe a simple or immediate decision; come to terms with emphasizes gradual, often difficult emotional acceptance.",
      memoryTrigger:
        "Picture the mind slowly moving from “I can’t accept this” to “I understand that this is real.”",
      memorySentence: "It takes time to come to terms with a painful truth.",
      recallQuestion:
        "What expression means gradually accepting a difficult reality?",
      recognitionTask:
        "Choose the natural use: accepting a life-changing diagnosis or accepting a slightly cold coffee.",
      productionTask:
        "Complete naturally: “It took me a long time to come to terms with ______.”",
      advancedNuance: [
        "Coming to terms with means the process is continuing.",
        "Came to terms with means acceptance was eventually reached.",
        "Hasn’t come to terms with means the person is still resisting or struggling.",
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
      "A line of reasoning that is strongly convincing and holds attention.",
    tamilMeaning: "மிகவும் நம்ப வைக்கும் வாதம்",
    coreIdea:
      "The reasons and evidence make the conclusion difficult to dismiss.",
    lesson: lesson({
      meaningType: "Abstract",
      connotation: "Positive when evaluating the quality of reasoning",
      tone: "Persuasive and thoughtful",
      register:
        "Neutral to formal; common in professional and academic English",
      sourceSentence:
        "The report makes a compelling argument for early action.",
      contextualMeaning:
        "The report gives strong reasons and evidence that make early action seem necessary.",
      usageNote:
        "Use compelling to evaluate how convincing an argument is, not merely whether you agree with its conclusion.",
      whenToUse: [
        "Use it for reasoning in essays, reports, debates, proposals and reviews.",
        "Use it when the evidence or logic strongly persuades the audience.",
      ],
      whenNotToUse: [
        "Do not call an argument compelling only because you personally like its conclusion.",
      ],
      mainPattern:
        "make / present + a compelling argument + for / against + noun",
      collocations: [
        "make a compelling argument",
        "present a compelling argument",
        "a compelling argument for change",
        "a compelling argument against the proposal",
      ],
      examples: {
        academic: "The author presents a compelling argument for reform.",
        business: "She made a compelling argument for investing now.",
        critical:
          "The idea is interesting, but it is not yet a compelling argument.",
      },
      miniConversation:
        "A: Did the proposal persuade you?\nB: Yes, it made a compelling argument for the change.",
      commonMistake:
        "Using compelling as if it simply meant an argument you agree with.",
      correction:
        "Use compelling when the reasoning or evidence is strongly convincing.",
      importantDifference:
        "A valid argument is logically sound; a compelling argument is powerfully persuasive. It may be compelling without being fully valid.",
      memoryTrigger:
        "Picture strong evidence pulling an undecided listener toward one side.",
      memorySentence:
        "The report makes a compelling argument for early action.",
      recallQuestion:
        "Which collocation describes a strongly convincing line of reasoning?",
      recognitionTask:
        "Decide whether personal preference alone can make an argument compelling.",
      productionTask:
        "Make a compelling argument for one useful habit using a reason and evidence.",
      advancedNuance: [
        "Compelling can also mean powerfully interesting or impossible to ignore, as in compelling evidence or a compelling story.",
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
      meaningType: "Idiomatic and abstract",
      connotation: "Negative because the attempt was unsuccessful",
      tone: "Matter-of-fact, disappointed or serious",
      register:
        "Neutral to formal; common in reports, narratives and journalism",
      sourceSentence:
        "We restarted the service several times, but to no avail.",
      contextualMeaning:
        "Several restart attempts were made, but none solved the problem.",
      usageNote:
        "It normally follows an unsuccessful effort and emphasizes that the intended result was not achieved.",
      whenToUse: [
        "Use it after describing one or more unsuccessful attempts.",
        "Use it in narratives, reports, formal conversation and journalism.",
      ],
      whenNotToUse: [
        "Avoid it when the attempt achieved a meaningful partial result.",
      ],
      mainPattern:
        "try / search / appeal + to no avail; clause + but to no avail",
      collocations: [
        "try to no avail",
        "search to no avail",
        "appeal to no avail",
        "but to no avail",
      ],
      examples: {
        narrative: "They searched throughout the night, but to no avail.",
        professional:
          "The team attempted to reproduce the defect, initially to no avail.",
        everyday: "I called several times, but to no avail.",
      },
      miniConversation:
        "A: Did restarting it fix the problem?\nB: I tried twice, but to no avail.",
      commonMistake: "I tried with no avail.",
      correction: "I tried to no avail.",
      importantDifference:
        "In vain has nearly the same meaning; to no avail often sounds slightly more formal and focuses on the lack of a useful result.",
      memoryTrigger:
        "Picture a key turning repeatedly while the locked door never opens.",
      memorySentence:
        "We restarted the service several times, but to no avail.",
      recallQuestion: "Which idiom means that an effort produced no result?",
      recognitionTask:
        "Choose the natural form: “but to no avail” or “but with no avail.”",
      productionTask:
        "Describe an unsuccessful attempt using “but to no avail.”",
      advancedNuance: [
        "To no avail usually comments on a completed or repeated effort; it is less natural for an attempt that is still in progress.",
      ],
    }),
  },
];

export const STARTER_SAMPLE_KEYS = STARTER_SAMPLES.map(
  (sample) => sample.canonicalKey,
);
