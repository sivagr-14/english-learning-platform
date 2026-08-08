import { up } from "./migrations/024_rel_06_idempotent_import";

describe("REL-06 import receipt migration", () => {
  it("cascades receipts when their vocabulary word is deleted", async () => {
    const onDelete = jest.fn();
    const column = {
      primary: jest.fn().mockReturnThis(),
      defaultTo: jest.fn().mockReturnThis(),
      notNullable: jest.fn().mockReturnThis(),
      references: jest.fn().mockReturnThis(),
      inTable: jest.fn().mockReturnThis(),
      onDelete,
      nullable: jest.fn().mockReturnThis(),
    };
    const table = {
      uuid: jest.fn(() => column),
      string: jest.fn(() => column),
      timestamp: jest.fn(() => column),
      jsonb: jest.fn(() => column),
      timestamps: jest.fn(),
      unique: jest.fn(),
    };
    const knex = {
      raw: jest.fn(() => "generated-id"),
      schema: {
        createTable: jest.fn(async (_name: string, define: (value: any) => void) =>
          define(table),
        ),
        alterTable: jest.fn(async (_name: string, define: (value: any) => void) =>
          define(table),
        ),
      },
    };

    await up(knex);

    expect(onDelete).toHaveBeenCalledWith("CASCADE");
  });
});
