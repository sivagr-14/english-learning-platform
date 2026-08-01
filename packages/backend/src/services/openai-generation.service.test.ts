import { STARTER_SAMPLES } from "../data/starter-samples";
import {
  OpenAIResponsesClient,
  openAIContract,
} from "./openai-generation.service";

describe("OpenAI automated vocabulary contract", () => {
  it("accepts a complete generated entry and rejects incomplete lessons", () => {
    const sample = STARTER_SAMPLES[0];
    expect(
      openAIContract.GeneratedEntrySchema.parse({
        pronunciation: sample.pronunciation,
        wordType: sample.wordType,
        englishMeaning: sample.englishMeaning,
        tamilMeaning: sample.tamilMeaning,
        coreIdea: sample.coreIdea,
        lesson: sample.lesson,
      }),
    ).toBeTruthy();

    expect(() =>
      openAIContract.GeneratedEntrySchema.parse({
        pronunciation: sample.pronunciation,
        wordType: sample.wordType,
        englishMeaning: sample.englishMeaning,
        tamilMeaning: sample.tamilMeaning,
        coreIdea: sample.coreIdea,
        lesson: { format_version: "simplified-v2" },
      }),
    ).toThrow();
  });

  it("uses Responses structured outputs without storing source content", async () => {
    const requests: any[] = [];
    const request = jest.fn(async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: "resp_local_test",
          output: [
            {
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({ candidates: [] }),
                },
              ],
            },
          ],
        }),
      } as Response;
    });
    const client = new OpenAIResponsesClient(
      "test-key",
      "test-model",
      request as typeof fetch,
    );

    const result = await client.structured<{ candidates: unknown[] }>(
      "vocabulary_candidates",
      openAIContract.candidateListJsonSchema,
      "Assess content",
      "A sufficiently long source paragraph for a test.",
    );

    expect(result.responseId).toBe("resp_local_test");
    expect(result.value).toEqual({ candidates: [] });
    expect(requests[0].store).toBe(false);
    expect(requests[0].text.format.type).toBe("json_schema");
    expect(requests[0].text.format.strict).toBe(true);
  });
});
