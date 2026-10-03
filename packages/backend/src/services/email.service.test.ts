import { EmailService } from "./email.service";

jest.mock("../utils/logger", () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }));

test("sign-in and welcome emails use Mastery Skills branding", async () => {
  const service = new EmailService();
  const sendMail = jest.fn().mockResolvedValue({ messageId: "fixture" });
  (service as any).transporter = { sendMail };
  await service.sendMagicLink("learner@example.invalid", "fixture-token");
  await service.sendWelcomeEmail("learner@example.invalid", "Learner");
  expect(sendMail).toHaveBeenCalledTimes(2);
  for (const [message] of sendMail.mock.calls) {
    expect(message.subject).toContain("Mastery Skills");
    expect(message.html).toContain("Mastery Skills");
    expect(message.text).toContain("Mastery Skills");
    expect(JSON.stringify(message)).not.toContain("English Mastery");
  }
});
