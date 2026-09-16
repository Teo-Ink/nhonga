/**
 * @nhoga/shared
 *
 * The logic that must behave identically on the server, the web app, and the mobile app —
 * because it touches money, identity, or order state, and a divergence between two
 * implementations would cost real money rather than merely looking different.
 *
 * Nothing in this package may import from `apps/*`. It has no runtime dependencies.
 */

export {
  add,
  allocate,
  applyBasisPoints,
  cents,
  centsFromDb,
  formatMZN,
  fromMeticais,
  isNegative,
  isZero,
  MAX_CENTS,
  max,
  min,
  MoneyError,
  multiply,
  parseMZNToCents,
  subtract,
  ZERO,
  type Cents,
  type FormatOptions,
} from './money.js';

export {
  formatAsTyped,
  formatInternational,
  formatNational,
  isValidMzMsisdn,
  maskMsisdn,
  MZ_DIALLING_CODE,
  normaliseMzMsisdn,
  operatorLabel,
  operatorOf,
  suggestedWalletFor,
  type MzOperator,
  type WalletProvider,
} from './phone.js';

export {
  applyPaymentEvent,
  canApplyPaymentEvent,
  canRefund,
  canRetryPayment,
  isPaymentPending,
  isPaymentSettled,
  isPaymentTerminal,
  PAYMENT_EVENT_TYPES,
  PAYMENT_STATUSES,
  PAYMENT_TRANSITIONS,
  requiresReconciliation,
  TERMINAL_PAYMENT_STATUSES,
  type PaymentEventType,
  type PaymentStatus,
  type PaymentTransitionResult,
} from './state-machines/payment.js';

export {
  applySubOrderEvent,
  canBuyerConfirmReceipt,
  canBuyerDispute,
  canVendorAct,
  EVENT_ACTORS,
  isSettlementEligible,
  isSettlementHeld,
  isSubOrderTerminal,
  ORDER_ROLLUP_STATUSES,
  rollupOrderStatus,
  shouldReleaseStock,
  SUB_ORDER_EVENT_TYPES,
  SUB_ORDER_STATUSES,
  SUB_ORDER_TRANSITIONS,
  TERMINAL_SUB_ORDER_STATUSES,
  type ActorType,
  type OrderRollupStatus,
  type SubOrderEventType,
  type SubOrderStatus,
  type SubOrderTransitionResult,
} from './state-machines/sub-order.js';

export {
  computeCartTotals,
  computeSettlement,
  distributeDiscount,
  PricingError,
  sumSettlements,
  type CartLine,
  type CartTotals,
  type CartTotalsOptions,
  type CommissionRule,
  type SettlementBreakdown,
  type SettlementInput,
  type VendorGroupTotals,
  type VendorShipping,
} from './pricing/cart.js';
