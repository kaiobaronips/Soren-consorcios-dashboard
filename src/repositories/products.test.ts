import { describe, expect, it } from "vitest";
import { toProduct, type Row } from "./products";

function baseRow(overrides: Partial<Row> = {}): Row {
  return {
    id: "id-1",
    product_name: "Produto Teste",
    product_code: "COD-1",
    administrator_name: "Administradora Teste",
    category: "property",
    credit_amount: 600000,
    term_months: 180,
    total_administration_fee_percent: 26.8,
    first_12_installment_amount: null,
    regular_installment_amount: 3220,
    correction_index: "INCC",
    status: "active",
    is_demo: false,
    ...overrides,
  };
}

describe("toProduct", () => {
  it("normaliza credit_amount (number) para string NUMERIC canônica com 2 casas", () => {
    const product = toProduct(baseRow({ credit_amount: 600000 }));
    expect(product.creditAmount).toBe("600000.00");
  });

  it("normaliza total_administration_fee_percent (number) para string com 3 casas", () => {
    const product = toProduct(baseRow({ total_administration_fee_percent: 26.8 }));
    expect(product.totalAdministrationFeePercent).toBe("26.800");
  });

  it("preserva null em first_12_installment_amount sem converter para string", () => {
    const product = toProduct(baseRow({ first_12_installment_amount: null }));
    expect(product.first12InstallmentAmount).toBeNull();
  });
});
