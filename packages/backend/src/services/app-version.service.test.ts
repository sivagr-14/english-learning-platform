import { resolveAppRevision } from "./app-version.service";

describe("resolveAppRevision", () => {
  it("uses a configured revision without invoking Git", () => {
    const execute = jest.fn();

    expect(
      resolveAppRevision({
        environment: { APP_REVISION: "D2C696739241F90F" },
        execute,
      }),
    ).toBe("d2c69673");
    expect(execute).not.toHaveBeenCalled();
  });

  it("reads the installed Git commit when no revision is configured", () => {
    const execute = jest.fn(() => "6c9ef6a3\n");

    expect(
      resolveAppRevision({
        environment: {},
        repositoryRoot: "/app",
        execute,
      }),
    ).toBe("6c9ef6a3");
    expect(execute).toHaveBeenCalledWith(
      "git",
      ["rev-parse", "--short=8", "HEAD"],
      { cwd: "/app", encoding: "utf8" },
    );
  });

  it("reports unknown when the installed revision cannot be read", () => {
    expect(
      resolveAppRevision({
        environment: { APP_REVISION: "not-a-commit" },
        execute: () => {
          throw new Error("Git is unavailable");
        },
      }),
    ).toBe("unknown");
  });
});
