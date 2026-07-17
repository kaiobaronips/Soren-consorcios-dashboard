import { describe, expect, it } from "vitest";
import { toClient, type Row } from "./clients";

function baseRow(overrides: Partial<Row> = {}): Row {
  return {
    id: "id-1",
    name: "Cliente Teste",
    email: "cliente@teste.com",
    phone: "11999999999",
    monthly_income: 5000,
    monthly_available_amount: 1500,
    consultant_id: "consultant-1",
    status: "active",
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("toClient", () => {
  it("normaliza monthly_income (number) para string NUMERIC canônica com 2 casas", () => {
    const client = toClient(baseRow({ monthly_income: 5000 }));
    expect(client.monthlyIncome).toBe("5000.00");
  });

  it("preserva null em monthly_income sem converter para string", () => {
    const client = toClient(baseRow({ monthly_income: null }));
    expect(client.monthlyIncome).toBeNull();
  });

  it("normaliza monthly_available_amount (number) para string NUMERIC canônica com 2 casas", () => {
    const client = toClient(baseRow({ monthly_available_amount: 1500 }));
    expect(client.monthlyAvailableAmount).toBe("1500.00");
  });
});
