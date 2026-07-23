import { describe, expect, it } from "vitest";
import { calculateBids, calculateDebtBalance, type Bid } from "./bids";

const BASE = {
  administrationFeePercent: "20",
  regularInstallmentAmount: "5000",
  termMonths: 100,
  contemplationMonth: 1,
};

describe("calculateDebtBalance", () => {
  it("saldo devedor = carta × (1 + taxaAdm%)", () => {
    // Exemplo de referência: carta 500k + taxa adm 20% = 600k.
    expect(calculateDebtBalance("500000", "20")).toBe("600000.00");
  });

  it("taxa adm zero → saldo devedor = carta", () => {
    expect(calculateDebtBalance("100000", "0")).toBe("100000.00");
  });
});

describe("calculateBids — oráculo dos exemplos do produto", () => {
  it("Lance embutido 25%: crédito 375k, saldo devedor após 475k", () => {
    const result = calculateBids({ ...BASE, creditAmount: "500000", bids: [{ type: "embedded25" }] });
    expect(result.debtBalance).toBe("600000.00");
    expect(result.embeddedBidAmount).toBe("125000.00");
    expect(result.ownBidAmount).toBe("0.00");
    expect(result.totalBidAmount).toBe("125000.00");
    expect(result.releasedCredit).toBe("375000.00");
    expect(result.debtBalanceAfter).toBe("475000.00");
    // 125000 / 600000 × 100 = 20,83%
    expect(result.bidPercent).toBe("20.83");
  });

  it("Lance embutido 25% + 25%: crédito 250k, saldo devedor após 350k", () => {
    const result = calculateBids({ ...BASE, creditAmount: "500000", bids: [{ type: "embedded25plus25" }] });
    expect(result.embeddedBidAmount).toBe("250000.00");
    expect(result.releasedCredit).toBe("250000.00");
    expect(result.debtBalanceAfter).toBe("350000.00");
    // 250000 / 600000 × 100 = 41,67%
    expect(result.bidPercent).toBe("41.67");
  });

  it("Lance livre (recursos próprios): não reduz o crédito, reduz o saldo devedor", () => {
    const result = calculateBids({ ...BASE, creditAmount: "500000", bids: [{ type: "free", amount: "60000" }] });
    expect(result.embeddedBidAmount).toBe("0.00");
    expect(result.ownBidAmount).toBe("60000.00");
    expect(result.releasedCredit).toBe("500000.00"); // carta cheia
    expect(result.debtBalanceAfter).toBe("540000.00"); // 600k − 60k
    // 60000 / 600000 × 100 = 10%
    expect(result.bidPercent).toBe("10.00");
  });

  it("Lance combinado (embutido 25% + livre): soma no lance e no saldo", () => {
    const bids: Bid[] = [{ type: "embedded25" }, { type: "free", amount: "60000" }];
    const result = calculateBids({ ...BASE, creditAmount: "500000", bids });
    expect(result.embeddedBidAmount).toBe("125000.00");
    expect(result.ownBidAmount).toBe("60000.00");
    expect(result.totalBidAmount).toBe("185000.00");
    expect(result.releasedCredit).toBe("375000.00"); // só o embutido reduz o crédito
    expect(result.debtBalanceAfter).toBe("415000.00"); // 600k − 185k
    // 185000 / 600000 × 100 = 30,83%
    expect(result.bidPercent).toBe("30.83");
  });

  it("sem lances: crédito e saldo devedor intactos, 0%", () => {
    const result = calculateBids({ ...BASE, creditAmount: "500000", bids: [] });
    expect(result.releasedCredit).toBe("500000.00");
    expect(result.debtBalanceAfter).toBe("600000.00");
    expect(result.bidPercent).toBe("0.00");
  });
});

describe("calculateBids — limites (clamps)", () => {
  it("embutido não excede a carta", () => {
    // 3 componentes de 25% + 25% (150%) → embutido limitado a 100% da carta.
    const result = calculateBids({
      ...BASE,
      creditAmount: "500000",
      bids: [{ type: "embedded25plus25" }, { type: "embedded25plus25" }, { type: "embedded25plus25" }],
    });
    expect(result.embeddedBidAmount).toBe("500000.00");
    expect(result.releasedCredit).toBe("0.00");
  });

  it("lance total não excede o saldo devedor", () => {
    const result = calculateBids({
      ...BASE,
      creditAmount: "500000",
      bids: [{ type: "free", amount: "9999999" }],
    });
    expect(result.totalBidAmount).toBe("600000.00");
    expect(result.debtBalanceAfter).toBe("0.00");
    expect(result.bidPercent).toBe("100.00");
  });

  it("valor de lance livre inválido/negativo é ignorado", () => {
    const result = calculateBids({ ...BASE, creditAmount: "500000", bids: [{ type: "free", amount: "-100" }] });
    expect(result.ownBidAmount).toBe("0.00");
    expect(result.totalBidAmount).toBe("0.00");
  });
});

describe("calculateBids — parcela/prazo após contemplação", () => {
  // carta 500k, taxa 20% → saldo 600k; parcela 5000; prazo 100; contemplação no mês 10.
  // Lance embutido 25% = 125000. Dívida restante = 5000 × 90 = 450000; após o lance = 325000.
  const result = calculateBids({
    creditAmount: "500000",
    administrationFeePercent: "20",
    regularInstallmentAmount: "5000",
    termMonths: 100,
    contemplationMonth: 10,
    bids: [{ type: "embedded25" }],
  });

  it("Redução das Parcelas: mantém o prazo restante, parcela menor", () => {
    expect(result.remainingTermBefore).toBe(90);
    // 325000 / 90 = 3611,11
    expect(result.installmentAfterReducingInstallment).toBe("3611.11");
  });

  it("Meses para quitar: mantém a parcela, encerra antes", () => {
    // Dívida restante após o lance = 325000; ÷ parcela 5000 = 65 meses para quitar.
    // (< prazo restante original de 90 meses no mês 10.)
    expect(result.monthsToSettleAfterBid).toBe(65);
  });
});
