import { describe, expect, it } from "vitest";
import { atenderSchema } from "./schema";

const baseInput = {
  clientId: "d9428888-122b-11e1-b85c-61cd3cbb3210",
  clientName: "Cliente",
  monthlyIncome: "5.000,00",
  monthlyAvailableAmount: "2.000,00",
  desiredCategory: "vehicle",
  desiredTermMonths: "48",
};

describe("atenderSchema", () => {
  it("exige um valor positivo quando a carta personalizada está selecionada", () => {
    const parsed = atenderSchema.safeParse({
      ...baseInput,
      customCreditEnabled: "true",
      customCreditAmount: "",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0].message).toBe(
        "Informe um valor de carta personalizada maior que zero",
      );
    }
  });

  it("normaliza o valor da carta personalizada", () => {
    const parsed = atenderSchema.parse({
      ...baseInput,
      customCreditEnabled: "true",
      customCreditAmount: "175.000,00",
    });

    expect(parsed.customCreditEnabled).toBe(true);
    expect(parsed.customCreditAmount).toBe("175000.00");
  });

  it("aceita o campo vazio quando o modo personalizado não está selecionado", () => {
    const parsed = atenderSchema.parse({
      ...baseInput,
      customCreditEnabled: "false",
      customCreditAmount: "",
    });

    expect(parsed.customCreditEnabled).toBe(false);
    expect(parsed.customCreditAmount).toBe("");
  });
});
