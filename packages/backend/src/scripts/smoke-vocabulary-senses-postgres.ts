import assert from "assert";
import { randomUUID } from "crypto";
import { VocabularyLesson } from "../data/vocabulary-lesson-template";
import { VocabularyImportService } from "../services/vocabulary-import.service";
import { displayVocabularyLabel } from "../services/vocabulary-sense.service";
import { database } from "../utils/db";

interface BankSense {
  key: string;
  meaning: string;
  sentence: string;
  explanation: string;
}

function bankLesson(sense: BankSense): VocabularyLesson {
  return {
    format_version: "simplified-v2",
    overview: {
      meaning_usage_profile: {
        meaning_type: "A literal contextual meaning of the noun bank.",
        connotation: "Neutral in this demonstrated source context.",
        tone: "Factual and descriptive in ordinary communication.",
        register: "Neutral English suitable for everyday use.",
      },
    },
    meaning_in_context: {
      source_sentence: sense.sentence,
      contextual_meaning: sense.meaning,
      simple_explanation: sense.explanation,
    },
    usage_guide: {
      when_to_use: [
        `Use bank when referring to ${sense.explanation.toLowerCase()}`,
      ],
      when_not_to_use: [
        "Do not substitute another meaning of bank in this demonstrated context.",
      ],
    },
    patterns_collocations: {
      main_pattern: "the bank + contextual verb or prepositional phrase",
      common_collocations: ["the nearby bank", "at the bank"],
    },
    natural_examples: {
      examples: {
        first: sense.sentence,
        second: `The guide explained exactly which bank the sentence referred to.`,
      },
      mini_conversation: `A: Which bank do you mean?\nB: I mean the bank described in this context.`,
    },
    mistakes_differences: {
      common_mistake:
        "A learner may attach the wrong dictionary meaning to bank.",
      correction: `In this sentence, bank means ${sense.meaning.toLowerCase()}`,
      important_difference:
        "Other senses share the spelling, but this entry teaches only the evidenced meaning.",
    },
    memory_practice: {
      memory_trigger: `Picture the exact bank described by the source sentence.`,
      memory_sentence: sense.sentence,
      recall_question:
        "What does bank mean in the demonstrated source sentence?",
      recognition_task:
        "Select the bank meaning supported by the surrounding situation.",
      production_task:
        "Write one new sentence using bank with this same contextual meaning.",
    },
    advanced_nuance: [
      "Bank keeps the same spelling across several senses, so context determines this entry's meaning.",
    ],
  };
}

async function importBankSense(userId: string, sense: BankSense) {
  const imported = await new VocabularyImportService(database).importSingle(
    {
      category: "Daily Life",
      word: "bank",
      pronunciation: "/bæŋk/",
      word_type: "Noun",
      item_type: "word",
      cefr_level: "B1",
      frequency: "High",
      english_meaning: sense.meaning,
      tamil_meaning: "சூழலின்படி bank என்பதன் குறிப்பிட்ட பொருள்",
      core_idea: sense.explanation,
      contextual_meaning: sense.meaning,
      sense_decision: "new_sense",
      sense_key: sense.key,
      sense_evidence: {
        sentence: sense.sentence,
        explanation: sense.explanation,
      },
      lesson_data: bankLesson(sense),
    },
    userId,
  );
  assert.equal(imported.imported, 1, imported.errors[0]?.message);
  return imported.items[0].word;
}

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const [owner] = await database("users")
    .insert({
      email: `sense-smoke-${suffix}@example.invalid`,
      username: `sense-smoke-${suffix}`,
      first_name: "Sense",
      email_verified: true,
    })
    .returning("*");

  const financial: BankSense = {
    key: "financial-institution",
    meaning: "A financial institution that receives, keeps, and lends money.",
    sentence: "She deposited the money at the bank before work.",
    explanation: "A business that safely keeps money and provides financial services.",
  };
  const river: BankSense = {
    key: "land-beside-river",
    meaning: "The sloping land along the side of a river.",
    sentence: "They rested on the river bank after the long walk.",
    explanation: "The ground directly beside the flowing river.",
  };
  const aircraft: BankSense = {
    key: "aircraft-sideways-tilt",
    meaning: "A sideways tilt made by an aircraft while turning.",
    sentence: "The pilot increased the bank to complete the turn.",
    explanation: "The aircraft's controlled sideways angle during a turn.",
  };
  const blood: BankSense = {
    key: "stored-biological-supply",
    meaning: "A place that stores blood or tissue for future medical use.",
    sentence: "The hospital contacted the blood bank for an urgent supply.",
    explanation: "A medical repository that stores donated biological material.",
  };

  try {
    const first = await importBankSense(owner.id, financial);
    const second = await importBankSense(owner.id, river);
    const third = await importBankSense(owner.id, aircraft);
    await database("user_progress")
      .where({ user_id: owner.id, word_id: first.id })
      .update({ times_reviewed: 7 });
    const replay = await importBankSense(owner.id, financial);

    assert.equal(first.id, replay.id, "same sense must reuse the stored entry");
    const preservedProgress = await database("user_progress")
      .where({ user_id: owner.id, word_id: first.id })
      .first();
    assert.equal(Number(preservedProgress.times_reviewed), 7);
    assert.equal(Number(first.sense_rank), 1);
    assert.equal(Number(second.sense_rank), 2);
    assert.equal(Number(third.sense_rank), 3);
    assert.equal(displayVocabularyLabel(first.word, first.sense_rank), "bank");
    assert.equal(
      displayVocabularyLabel(second.word, second.sense_rank),
      "bank (B)",
    );
    assert.equal(
      displayVocabularyLabel(third.word, third.sense_rank),
      "bank (C)",
    );

    await database("vocabulary_words").where({ id: second.id }).delete();
    const fourth = await importBankSense(owner.id, blood);
    assert.equal(Number(fourth.sense_rank), 4);
    assert.equal(
      displayVocabularyLabel(fourth.word, fourth.sense_rank),
      "bank (D)",
      "deleted ranks must never be reused",
    );

    const rows = await database("vocabulary_words")
      .where({ owner_user_id: owner.id, normalized_term: "bank" })
      .orderBy("sense_rank")
      .select("word", "sense_rank", "sense_key");
    assert.deepEqual(
      rows.map((row: any) => Number(row.sense_rank)),
      [1, 3, 4],
    );
    assert(rows.every((row: any) => row.word === "bank"));

    console.log(
      JSON.stringify({
        status: "passed",
        sameSenseReused: true,
        progressPreserved: true,
        createdLabels: ["bank", "bank (B)", "bank (C)", "bank (D)"],
        deletedRankReused: false,
      }),
    );
  } finally {
    await database("users").where({ id: owner.id }).delete();
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await database.destroy();
  });
