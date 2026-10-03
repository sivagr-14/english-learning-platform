import {
  advanceSkill,
  localDay,
  ProfileSchema,
  SkillState,
} from "./fluency-learning";

describe("evidence-based self-assessed progress", () => {
  it("does not turn repeated same-day successes into mastery or inflate intervals", () => {
    let state: SkillState | undefined;
    for (let i = 0; i < 10; i++)
      state = advanceSkill(
        state,
        true,
        "speaking",
        "work",
        new Date("2026-10-03T12:00:00Z"),
        "Europe/Warsaw",
      ).state;
    expect(state?.stage).toBe("recognised");
    expect(state?.intervalDays).toBe(1);
  });
  it("requires delayed production and context transfer, and resets evidence after a failure", () => {
    let state: SkillState | undefined;
    for (const [date, context] of [
      ["03", "work"],
      ["05", "work"],
      ["08", "daily_life"],
    ])
      state = advanceSkill(
        state,
        true,
        "speaking",
        context,
        new Date(`2026-10-${date}T12:00:00Z`),
        "Europe/Warsaw",
      ).state;
    expect(state?.stage).toBe("usable");
    const retained = advanceSkill(
      state,
      true,
      "speaking",
      "work",
      new Date("2026-10-20T12:00:00Z"),
      "Europe/Warsaw",
    );
    expect(retained.state.stage).toBe("retained");
    const missed = advanceSkill(
      retained.state,
      false,
      "speaking",
      "work",
      new Date("2026-10-21T12:00:00Z"),
      "Europe/Warsaw",
    );
    expect(missed.state.stage).toBe("learning");
    expect(missed.state.successfulDays).toEqual([]);
    expect(missed.due_at.toISOString()).toBe("2026-10-21T12:10:00.000Z");
  });
  it("recognition successes never become productive evidence", () => {
    let state: SkillState | undefined;
    for (const date of ["03", "05", "08"])
      state = advanceSkill(
        state,
        true,
        "recognition",
        "work",
        new Date(`2026-10-${date}T12:00:00Z`),
        "Europe/Warsaw",
      ).state;
    expect(state?.stage).toBe("recallable");
  });
  it("uses the learner's day across daylight-saving boundaries", () => {
    expect(localDay(new Date("2026-10-03T22:30:00Z"), "Europe/Warsaw")).toBe(
      "2026-10-04",
    );
    expect(localDay(new Date("2026-10-25T22:30:00Z"), "Europe/Warsaw")).toBe(
      "2026-10-25",
    );
    expect(
      ProfileSchema.safeParse({
        timezone: "not-a-zone",
        daily_minutes: 20,
        new_per_day: 10,
        focus: "balanced",
      }).success,
    ).toBe(false);
  });
});
