export const VOCABULARY_SECTION_TEMPLATE = [
  "Basic Information",
  "Meaning",
  "Memory Mastery",
  "Meaning Expansion",
  "Usage Mastery",
  "Word Usage Zone",
  "Natural Domains",
  "Domain Restrictions",
  "Context Switching Test",
  "Word Nature",
  "Register",
  "Common Contexts",
  "Tamil Usage Notes",
  "When To Use",
  "When NOT To Use",
  "Application",
  "Collocations",
  "Native Usage Patterns",
  "Common Mistakes",
  "Confusion Zone",
  "Alternatives & Synonyms",
  "Frequency By Context",
  "Mini Conversation",
  "Learn The Pattern",
  "Guided Practice",
  "Evaluation",
  "Feedback",
  "Mastery Notes",
  "Native Thinking Model",
];

export const VOCABULARY_SECTION_TEMPLATE_PROMPT =
  VOCABULARY_SECTION_TEMPLATE.map(
    (title, index) => `${index + 1}. ${title}`
  ).join("\n");
