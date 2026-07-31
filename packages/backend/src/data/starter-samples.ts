import {
  assertVocabularyLessonCompliant,
  VocabularyLesson,
  VOCABULARY_LESSON_FORMAT_VERSION,
} from "./vocabulary-lesson-template";

export const STARTER_SAMPLE_VERSION = 4;

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
  lesson: VocabularyLesson;
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
  advancedNuance: string[];
}

function lesson(term: string, input: LessonInput) {
  const value = {
    format_version: VOCABULARY_LESSON_FORMAT_VERSION,
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
    advanced_nuance: input.advancedNuance,
  };

  return assertVocabularyLessonCompliant(value, term);
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
    lesson: lesson("straightforward", {
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
    lesson: lesson("come to terms with", {
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
    lesson: lesson("a compelling argument", {
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
        "In a compelling argument, compelling evaluates persuasive force; elsewhere it can mean powerfully interesting or impossible to ignore, as in compelling evidence or a compelling story.",
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
    lesson: lesson("to no avail", {
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
  {
    word: "practical",
    canonicalKey: "practical|adjective",
    pronunciation: "/ˈpræktɪkəl/",
    wordType: "Adjective",
    itemType: "word",
    cefrLevel: "B2",
    frequency: "Heavy",
    categoryName: "Daily Life",
    englishMeaning: "Useful, realistic and suitable for an actual situation.",
    tamilMeaning: "நடைமுறைக்கு ஏற்ற / பயனுள்ள",
    coreIdea: "The idea works in real life, not only in theory.",
    lesson: lesson("practical", {
      meaningType: "Literal and abstract",
      connotation: "Usually positive",
      tone: "Realistic and solution-focused",
      register: "Neutral; common in everyday and professional English",
      sourceSentence: "We need a practical solution that we can use today.",
      contextualMeaning:
        "The solution must be realistic, useful and possible to apply immediately.",
      usageNote:
        "Practical describes an idea, skill or object that works well in a real situation.",
      whenToUse: [
        "Use practical for realistic advice, useful skills and workable solutions.",
        "Use practical when real-world usefulness matters more than theory.",
      ],
      whenNotToUse: [
        "Do not use practical merely to mean morally correct or intellectually interesting.",
      ],
      mainPattern: "a practical + noun; it is practical to + verb",
      collocations: [
        "practical advice",
        "practical solution",
        "practical experience",
        "practical approach",
      ],
      examples: {
        everyday: "A backpack is more practical than a suitcase for this trip.",
        professional: "The team proposed a practical solution to the delay.",
        learning: "The course gives practical experience with real projects.",
      },
      miniConversation:
        "A: Is this plan realistic?\nB: Yes, it is simple and practical.",
      commonMistake:
        "Using practical when practicable is specifically intended.",
      correction:
        "Say “This is a practical plan” for a useful plan; practicable mainly means that it can be done.",
      importantDifference:
        "Practical emphasizes usefulness and realism; possible only says that something can happen or be done.",
      memoryTrigger: "Picture a tool that solves a real problem immediately.",
      memorySentence: "A practical idea works outside the classroom.",
      recallQuestion:
        "Which adjective means useful and realistic in real life?",
      recognitionTask:
        "Choose the practical option for rain: carrying an umbrella or discussing weather theory.",
      productionTask: "Describe one practical change you can make this week.",
      advancedNuance: [
        "A practical person tends to focus on realistic action, while a practical object is useful for its intended purpose.",
      ],
    }),
  },
  {
    word: "manageable",
    canonicalKey: "manageable|adjective",
    pronunciation: "/ˈmænɪdʒəbəl/",
    wordType: "Adjective",
    itemType: "word",
    cefrLevel: "B2",
    frequency: "Heavy",
    categoryName: "Daily Life",
    englishMeaning:
      "Possible to control, organize or complete without excessive difficulty.",
    tamilMeaning: "சமாளிக்கக்கூடிய / நிர்வகிக்கக்கூடிய",
    coreIdea: "The challenge is within your ability to handle.",
    lesson: lesson("manageable", {
      meaningType: "Abstract",
      connotation: "Positive or reassuring",
      tone: "Calm and realistic",
      register: "Neutral; natural in everyday and professional English",
      sourceSentence: "Breaking the task into steps made it manageable.",
      contextualMeaning:
        "The task became easier to control and complete after it was divided into smaller parts.",
      usageNote:
        "Manageable does not mean effortless; it means the difficulty remains within reasonable limits.",
      whenToUse: [
        "Use manageable for workloads, costs, pain, risks or problems that can be handled.",
        "Use manageable to reassure someone that a challenge is under control.",
      ],
      whenNotToUse: [
        "Do not use manageable when something is completely effortless or genuinely impossible to control.",
      ],
      mainPattern: "become / remain / make + something + manageable",
      collocations: [
        "manageable workload",
        "manageable size",
        "manageable level",
        "make the problem manageable",
      ],
      examples: {
        everyday: "The monthly payment is manageable for us.",
        professional: "We divided the project into manageable stages.",
        health: "The exercises helped keep the discomfort manageable.",
      },
      miniConversation:
        "A: Is the workload too heavy?\nB: It is busy, but still manageable.",
      commonMistake: "Treating manageable as a synonym for completely easy.",
      correction:
        "Say “The task is difficult but manageable” when it requires effort yet can still be completed.",
      importantDifference:
        "Easy requires little effort; manageable may be difficult but remains possible to handle.",
      memoryTrigger:
        "Picture a large box divided into smaller boxes you can carry.",
      memorySentence: "Small steps make a difficult goal manageable.",
      recallQuestion: "Which adjective means difficult but possible to handle?",
      recognitionTask:
        "Decide whether a demanding but controllable workload can be called manageable.",
      productionTask:
        "Explain how you could make one difficult task manageable.",
      advancedNuance: [
        "Manageable often deliberately acknowledges some difficulty, so it can sound more realistic than easy.",
      ],
    }),
  },
  {
    word: "resilient",
    canonicalKey: "resilient|adjective",
    pronunciation: "/rɪˈzɪliənt/",
    wordType: "Adjective",
    itemType: "word",
    cefrLevel: "C1",
    frequency: "Medium",
    categoryName: "Emotions & Personality",
    englishMeaning:
      "Able to recover and adapt after difficulty, stress or change.",
    tamilMeaning: "சிரமத்திற்குப் பிறகு மீண்டு வரக்கூடிய மனவலிமை கொண்ட",
    coreIdea: "Pressure causes difficulty, but recovery and adaptation follow.",
    lesson: lesson("resilient", {
      meaningType: "Literal and abstract",
      connotation: "Strongly positive",
      tone: "Encouraging and respectful",
      register:
        "Neutral to formal; common in personal and professional English",
      sourceSentence:
        "She remained resilient after several disappointing results.",
      contextualMeaning:
        "She recovered emotionally and continued adapting despite repeated disappointments.",
      usageNote:
        "Resilient describes recovery and adaptation, not the absence of pain, stress or failure.",
      whenToUse: [
        "Use resilient for people or communities that recover after hardship.",
        "Use resilient for systems or materials that withstand disruption and return to function.",
      ],
      whenNotToUse: [
        "Do not use resilient to suggest that a person never needs help or never feels distress.",
      ],
      mainPattern:
        "be / remain + resilient; resilient in the face of + difficulty",
      collocations: [
        "emotionally resilient",
        "highly resilient",
        "resilient community",
        "resilient in the face of change",
      ],
      examples: {
        personal: "Children can be remarkably resilient after a major change.",
        professional: "The company built a more resilient supply chain.",
        community: "The resilient community rebuilt after the flood.",
      },
      miniConversation:
        "A: How did she cope with the setback?\nB: She was upset, but she stayed resilient.",
      commonMistake: "Using resistant when resilient is intended.",
      correction:
        "Say “She is resilient after setbacks” when she recovers; resistant means she opposes or is not affected by something.",
      importantDifference:
        "Strong emphasizes power; resilient specifically emphasizes recovery and adaptation after pressure.",
      memoryTrigger: "Picture a branch bending in a storm and springing back.",
      memorySentence: "A resilient person bends under pressure but recovers.",
      recallQuestion:
        "Which adjective describes the ability to recover after difficulty?",
      recognitionTask:
        "Choose the resilient response: adapting after a setback or pretending the setback never happened.",
      productionTask:
        "Describe a resilient person and explain how they recovered.",
      advancedNuance: [
        "Calling someone resilient can be admiring, but resilient should not be used to dismiss their need for support.",
      ],
    }),
  },
  {
    word: "overwhelmed",
    canonicalKey: "overwhelmed|adjective",
    pronunciation: "/ˌoʊvərˈwelmd/",
    wordType: "Adjective",
    itemType: "word",
    cefrLevel: "B2",
    frequency: "Heavy",
    categoryName: "Emotions & Personality",
    englishMeaning:
      "Feeling unable to cope because something is too intense or demanding.",
    tamilMeaning: "அளவுக்கு மீறிய அழுத்தத்தால் சமாளிக்க முடியாமல் உணருதல்",
    coreIdea:
      "The emotional or practical demand feels greater than your capacity.",
    lesson: lesson("overwhelmed", {
      meaningType:
        "Usually abstract; sometimes literal in passive constructions",
      connotation:
        "Usually negative, but can be positive with gratitude or joy",
      tone: "Emotional and candid",
      register: "Neutral; very common in everyday English",
      sourceSentence:
        "I felt overwhelmed by the number of decisions I had to make.",
      contextualMeaning:
        "The many decisions felt too demanding for the speaker to handle comfortably.",
      usageNote:
        "Overwhelmed commonly describes excessive stress, but context can make it positive, as in overwhelmed with gratitude.",
      whenToUse: [
        "Use overwhelmed when work, emotion, information or responsibility feels too intense.",
        "Use overwhelmed with a positive emotion when it is exceptionally powerful.",
      ],
      whenNotToUse: [
        "Do not use overwhelmed for mild busyness that you can comfortably manage.",
      ],
      mainPattern: "feel / be + overwhelmed by / with + noun",
      collocations: [
        "feel overwhelmed",
        "overwhelmed by work",
        "overwhelmed with emotion",
        "completely overwhelmed",
      ],
      examples: {
        everyday: "I felt overwhelmed by all the paperwork.",
        positive: "She was overwhelmed with gratitude for their support.",
        professional:
          "New employees may feel overwhelmed during the first week.",
      },
      miniConversation:
        "A: You seem stressed.\nB: I am overwhelmed by everything I need to finish.",
      commonMistake:
        "Saying overwhelmed from work instead of overwhelmed by work.",
      correction:
        "Say “I am overwhelmed by work” or “I am overwhelmed with work.”",
      importantDifference:
        "Stressed describes pressure; overwhelmed means the pressure feels greater than your ability to cope.",
      memoryTrigger:
        "Picture a small cup receiving more water than it can hold.",
      memorySentence: "Too many urgent tasks can leave anyone overwhelmed.",
      recallQuestion:
        "Which adjective means feeling unable to cope with too much demand?",
      recognitionTask:
        "Choose the stronger feeling: slightly busy or completely overwhelmed by responsibilities.",
      productionTask:
        "Describe a situation in which someone might feel overwhelmed.",
      advancedNuance: [
        "Overwhelmed by usually names the cause, while overwhelmed with often names the amount or emotion filling the person.",
      ],
    }),
  },
  {
    word: "draw a conclusion",
    canonicalKey: "draw a conclusion|collocation",
    pronunciation: "/drɔː ə kənˈkluːʒən/",
    wordType: "Collocation",
    itemType: "collocation",
    cefrLevel: "B2",
    frequency: "Heavy",
    categoryName: "Academic English",
    englishMeaning:
      "To form a judgment after considering evidence or information.",
    tamilMeaning: "ஆதாரங்களை ஆராய்ந்து ஒரு முடிவுக்கு வருதல்",
    coreIdea: "Evidence is examined before a judgment is formed.",
    lesson: lesson("draw a conclusion", {
      meaningType: "Abstract and figurative",
      connotation: "Neutral in most contexts",
      tone: "Analytical and careful",
      register:
        "Neutral to formal; common in academic and professional English",
      sourceSentence: "We cannot draw a conclusion from one isolated example.",
      contextualMeaning:
        "One example does not provide enough evidence to form a reliable judgment.",
      usageNote:
        "Draw a conclusion focuses on reaching a judgment through evidence, observation or reasoning.",
      whenToUse: [
        "Use draw a conclusion when evidence leads to a reasoned judgment.",
        "Use it in analysis, research, reports and careful discussion.",
      ],
      whenNotToUse: [
        "Do not draw a conclusion when you are merely describing a decision or ending a meeting.",
      ],
      mainPattern:
        "draw a conclusion from + evidence; draw the conclusion that + clause",
      collocations: [
        "draw a reasonable conclusion",
        "draw a firm conclusion",
        "draw a conclusion from the data",
        "too early to draw a conclusion",
      ],
      examples: {
        academic:
          "The researchers could not draw a conclusion from the small sample.",
        professional:
          "It is too early to draw a conclusion about the new process.",
        everyday: "Do not draw a conclusion before hearing both sides.",
      },
      miniConversation:
        "A: Does one complaint prove the service is poor?\nB: No, we cannot draw a conclusion yet.",
      commonMistake:
        "Saying make a conclusion when draw a conclusion is the standard collocation.",
      correction:
        "Say “draw a conclusion” or “reach a conclusion,” not “make a conclusion.”",
      importantDifference:
        "Draw a conclusion emphasizes reasoning from evidence; make a decision emphasizes choosing what to do.",
      memoryTrigger:
        "Picture evidence lines being drawn together into one final point.",
      memorySentence:
        "Careful thinkers draw a conclusion only after examining the evidence.",
      recallQuestion:
        "Which collocation means forming a judgment from evidence?",
      recognitionTask:
        "Choose the stronger basis for drawing a conclusion: repeated evidence or one rumor.",
      productionTask:
        "Use draw a conclusion to explain what some evidence suggests.",
      advancedNuance: [
        "Draw a conclusion and reach a conclusion are close, but draw a conclusion more clearly highlights inference from evidence.",
      ],
    }),
  },
  {
    word: "substantiate",
    canonicalKey: "substantiate|verb",
    pronunciation: "/səbˈstænʃieɪt/",
    wordType: "Verb",
    itemType: "word",
    cefrLevel: "C1",
    frequency: "Medium",
    categoryName: "Academic English",
    englishMeaning: "To support a claim with evidence or proof.",
    tamilMeaning: "ஆதாரம் காட்டி ஒரு கூற்றை நிரூபித்தல்",
    coreIdea: "A statement becomes credible because evidence supports it.",
    lesson: lesson("substantiate", {
      meaningType: "Abstract and technical",
      connotation: "Neutral in most contexts",
      tone: "Formal and evidence-focused",
      register: "Formal; common in academic, legal and professional English",
      sourceSentence:
        "The report does not substantiate its main claim with reliable data.",
      contextualMeaning:
        "The report fails to provide trustworthy evidence supporting its central claim.",
      usageNote:
        "Substantiate requires evidence; repeating or explaining a claim does not substantiate it.",
      whenToUse: [
        "Use substantiate when evidence supports an allegation, claim or argument.",
        "Use it in research, investigations, formal reports and careful analysis.",
      ],
      whenNotToUse: [
        "Do not use substantiate when someone merely states an opinion without supporting evidence.",
      ],
      mainPattern: "substantiate + claim / allegation + with + evidence",
      collocations: [
        "substantiate a claim",
        "substantiate an allegation",
        "substantiate the argument",
        "substantiate with evidence",
      ],
      examples: {
        academic: "The study substantiates the theory with new evidence.",
        legal: "The witness could not substantiate the allegation.",
        professional: "Please substantiate your estimate with recent data.",
      },
      miniConversation:
        "A: Is the accusation credible?\nB: Not yet; nobody has substantiated it with evidence.",
      commonMistake: "Using explain as though it always means substantiate.",
      correction:
        "An explanation describes a claim, but evidence is needed to substantiate the claim.",
      importantDifference:
        "Support can be broad and informal; substantiate specifically means providing adequate evidence or proof.",
      memoryTrigger:
        "Picture solid evidence being placed underneath a claim to hold it up.",
      memorySentence: "Reliable evidence can substantiate a serious claim.",
      recallQuestion:
        "Which formal verb means supporting a claim with evidence?",
      recognitionTask:
        "Decide whether an unsupported opinion can substantiate an allegation.",
      productionTask:
        "Write one sentence using substantiate with evidence or data.",
      advancedNuance: [
        "Substantiate does not always mean prove beyond doubt; it can mean supplying enough evidence to give a claim credible support.",
      ],
    }),
  },
  {
    word: "by and large",
    canonicalKey: "by and large|idiom",
    pronunciation: "/baɪ ən lɑːrdʒ/",
    wordType: "Idiom",
    itemType: "idiom",
    cefrLevel: "C1",
    frequency: "Medium",
    categoryName: "Advanced Conversation",
    englishMeaning: "Generally or when considering the situation as a whole.",
    tamilMeaning: "பொதுவாக / மொத்தத்தில் பார்க்கும்போது",
    coreIdea: "The overall pattern is true even though exceptions may exist.",
    lesson: lesson("by and large", {
      meaningType: "Idiomatic and abstract",
      connotation: "Neutral and context-dependent",
      tone: "Balanced and conversational",
      register: "Neutral; natural in conversation, commentary and writing",
      sourceSentence: "By and large, the new system has worked well.",
      contextualMeaning:
        "The system has generally worked well, although there may have been some exceptions.",
      usageNote:
        "By and large gives an overall judgment while leaving room for minor exceptions.",
      whenToUse: [
        "Use by and large to summarize the main pattern or overall result.",
        "Use it when exceptions exist but do not change the general judgment.",
      ],
      whenNotToUse: [
        "Do not use by and large for an absolute claim with no exceptions.",
      ],
      mainPattern: "By and large, + complete clause",
      collocations: [
        "by and large successful",
        "by and large satisfied",
        "by and large accurate",
        "by and large the same",
      ],
      examples: {
        everyday: "By and large, people were friendly and helpful.",
        professional: "The rollout was, by and large, successful.",
        evaluation: "By and large, the feedback has been positive.",
      },
      miniConversation:
        "A: Did the plan work?\nB: By and large, yes, although two steps need improvement.",
      commonMistake: "Writing by in large instead of by and large.",
      correction: "The fixed idiom is “by and large.”",
      importantDifference:
        "Generally is direct and flexible; by and large often sounds more reflective and explicitly allows exceptions.",
      memoryTrigger: "Picture stepping back to see the large overall picture.",
      memorySentence: "By and large, the project achieved what we expected.",
      recallQuestion: "Which idiom means generally or considered as a whole?",
      recognitionTask:
        "Choose by and large when most results are good but a few exceptions remain.",
      productionTask: "Give an overall evaluation beginning with by and large.",
      advancedNuance: [
        "By and large can appear at the beginning or inside a clause, but the opening position makes the overall judgment especially clear.",
      ],
    }),
  },
  {
    word: "at odds with",
    canonicalKey: "at odds with|expression",
    pronunciation: "/æt ɑːdz wɪð/",
    wordType: "Expression",
    itemType: "fixed expression",
    cefrLevel: "C1",
    frequency: "Medium",
    categoryName: "Advanced Conversation",
    englishMeaning: "In conflict or disagreement with someone or something.",
    tamilMeaning: "முரண்பாட்டில் / ஒத்துப்போகாமல் இருப்பது",
    coreIdea: "Two people, ideas or facts do not agree or fit together.",
    lesson: lesson("at odds with", {
      meaningType: "Figurative, idiomatic and abstract",
      connotation: "Usually negative or neutral",
      tone: "Serious and analytical",
      register: "Neutral to formal; common in discussion and journalism",
      sourceSentence: "His explanation is at odds with the available evidence.",
      contextualMeaning:
        "His explanation conflicts with what the existing evidence indicates.",
      usageNote:
        "At odds with can describe interpersonal disagreement or an inconsistency between ideas, values, facts or actions.",
      whenToUse: [
        "Use at odds with when people disagree strongly.",
        "Use it when a claim, action or value conflicts with another fact or principle.",
      ],
      whenNotToUse: [
        "Do not use at odds with for a small difference that creates no meaningful conflict.",
      ],
      mainPattern: "be at odds with + person / evidence / values / policy",
      collocations: [
        "at odds with the evidence",
        "at odds with each other",
        "at odds with our values",
        "fundamentally at odds with",
      ],
      examples: {
        personal: "The two colleagues are at odds with each other.",
        professional: "The proposal is at odds with current policy.",
        analytical: "That claim is at odds with the survey results.",
      },
      miniConversation:
        "A: Why was the proposal rejected?\nB: It was at odds with the organization’s values.",
      commonMistake: "Saying in odds with instead of at odds with.",
      correction: "Use the fixed expression “at odds with.”",
      importantDifference:
        "Disagree with commonly describes people or opinions; at odds with also naturally describes conflicting evidence, values or actions.",
      memoryTrigger: "Picture two arrows pointing in opposing directions.",
      memorySentence:
        "A claim at odds with the evidence needs closer examination.",
      recallQuestion:
        "Which expression means being in conflict or disagreement?",
      recognitionTask:
        "Choose at odds with when a statement directly conflicts with reliable evidence.",
      productionTask: "Describe two ideas that are at odds with each other.",
      advancedNuance: [
        "At odds with often suggests an underlying incompatibility, not only one temporary disagreement.",
      ],
    }),
  },
];

export const STARTER_SAMPLE_KEYS = STARTER_SAMPLES.map(
  (sample) => sample.canonicalKey,
);
