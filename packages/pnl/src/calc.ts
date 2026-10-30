import { d, Decimal, bpsToRate, toNumericString, zero } from "./decimal.js";

export type ExecutionAssumptions = {
  feeBps: number;
  slippageBps: number;
};

export type BuyModel = {
  quoteAmount: Decimal;
  quotePrice: Decimal;
  executionPrice: Decimal;
  fees: Decimal;
  quantity: Decimal;
  costBasis: Decimal;
};

export type SellModel = {
  quantity: Decimal;
  quotePrice: Decimal;
  executionPrice: Decimal;
  grossValue: Decimal;
  sellFees: Decimal;
  proceeds: Decimal;
  allocatedCostBasis: Decimal;
  realizedPnl: Decimal;
};

export function modeledBuy(input: {
  quoteAmount: Decimal.Value;
  quotePrice: Decimal.Value;
  assumptions: ExecutionAssumptions;
}): BuyModel {
  const quoteAmount = d(input.quoteAmount);
  const quotePrice = d(input.quotePrice);
  if (quoteAmount.lte(0)) throw new Error("quote amount must be positive");
  if (quotePrice.lte(0)) throw new Error("quote price must be positive");

  const slippage = bpsToRate(input.assumptions.slippageBps);
  const feeRate = bpsToRate(input.assumptions.feeBps);
  const executionPrice = quotePrice.mul(d(1).plus(slippage));
  const fees = quoteAmount.mul(feeRate);
  const spendForTokens = quoteAmount.minus(fees);
  if (spendForTokens.lte(0)) {
    throw new Error("fees consume the entire practice amount");
  }
  const quantity = spendForTokens.div(executionPrice);
  return {
    quoteAmount,
    quotePrice,
    executionPrice,
    fees,
    quantity,
    costBasis: quoteAmount,
  };
}

export function modeledSell(input: {
  quantity: Decimal.Value;
  quotePrice: Decimal.Value;
  remainingQuantity: Decimal.Value;
  remainingCostBasis: Decimal.Value;
  assumptions: ExecutionAssumptions;
}): SellModel {
  const quantity = d(input.quantity);
  const remainingQuantity = d(input.remainingQuantity);
  const remainingCostBasis = d(input.remainingCostBasis);
  const quotePrice = d(input.quotePrice);
  if (quantity.lte(0)) throw new Error("sell quantity must be positive");
  if (quantity.gt(remainingQuantity)) {
    throw new Error("sell quantity exceeds open quantity");
  }
  if (quotePrice.lte(0)) throw new Error("quote price must be positive");

  const slippage = bpsToRate(input.assumptions.slippageBps);
  const feeRate = bpsToRate(input.assumptions.feeBps);
  const executionPrice = quotePrice.mul(d(1).minus(slippage));
  if (executionPrice.lte(0)) {
    throw new Error("slippage consumes the entire price");
  }
  const grossValue = quantity.mul(executionPrice);
  const sellFees = grossValue.mul(feeRate);
  const proceeds = grossValue.minus(sellFees);
  const allocatedCostBasis = remainingQuantity.eq(0)
    ? zero()
    : remainingCostBasis.mul(quantity).div(remainingQuantity);
  const realizedPnl = proceeds.minus(allocatedCostBasis);

  return {
    quantity,
    quotePrice,
    executionPrice,
    grossValue,
    sellFees,
    proceeds,
    allocatedCostBasis,
    realizedPnl,
  };
}

export function weightedAverageEntry(
  remainingCostBasis: Decimal.Value,
  remainingQuantity: Decimal.Value,
): Decimal {
  const qty = d(remainingQuantity);
  if (qty.lte(0)) return zero();
  return d(remainingCostBasis).div(qty);
}

export function estimatedCloseFees(
  quantity: Decimal.Value,
  markPrice: Decimal.Value,
  assumptions: ExecutionAssumptions,
): Decimal {
  const slippage = bpsToRate(assumptions.slippageBps);
  const feeRate = bpsToRate(assumptions.feeBps);
  const executionPrice = d(markPrice).mul(d(1).minus(slippage));
  const gross = d(quantity).mul(executionPrice);
  return gross.mul(feeRate);
}

export function unrealizedPnl(input: {
  quantity: Decimal.Value;
  remainingCostBasis: Decimal.Value;
  markPrice: Decimal.Value;
  assumptions: ExecutionAssumptions;
}): Decimal {
  const markValue = d(input.quantity).mul(d(input.markPrice));
  const closeFees = estimatedCloseFees(
    input.quantity,
    input.markPrice,
    input.assumptions,
  );
  return markValue.minus(d(input.remainingCostBasis)).minus(closeFees);
}

export function pnlPercent(
  totalPnl: Decimal.Value,
  costBasis: Decimal.Value,
): Decimal {
  const basis = d(costBasis);
  if (basis.eq(0)) return zero();
  return d(totalPnl).div(basis).mul(100);
}

export function formatUsd(value: Decimal.Value, digits = 2): string {
  const n = d(value);
  const sign = n.isNeg() ? "-" : "";
  const abs = n.abs();
  if (abs.gte(1_000_000)) {
    return `${sign}$${abs.div(1_000_000).toFixed(2)}M`;
  }
  if (abs.gte(10_000)) {
    return `${sign}$${abs.div(1_000).toFixed(1)}K`;
  }
  if (abs.gte(1000)) {
    return `${sign}$${abs.toFixed(2)}`;
  }
  if (abs.gte(1)) {
    return `${sign}$${abs.toFixed(digits)}`;
  }
  if (abs.eq(0)) return "$0.00";
  return `${sign}$${abs.toSignificantDigits(4).toString()}`;
}

export function formatPercent(value: Decimal.Value, digits = 2): string {
  const n = d(value);
  const sign = n.gt(0) ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

function trimZeros(value: string): string {
  if (!value.includes(".")) return value;
  return value.replace(/\.?0+$/, "");
}

export function formatQty(value: Decimal.Value): string {
  const n = d(value);
  if (n.eq(0)) return "0";
  if (n.gte(1000)) return n.toFixed(2);
  if (n.gte(1)) return trimZeros(n.toFixed(4));
  return n.toSignificantDigits(6).toString();
}

export function formatPrice(value: Decimal.Value): string {
  const n = d(value);
  if (n.eq(0)) return "0";
  if (n.gte(1000)) return n.toFixed(2);
  if (n.gte(1)) return trimZeros(n.toFixed(4));
  return n.toSignificantDigits(6).toString();
}

export { toNumericString };
