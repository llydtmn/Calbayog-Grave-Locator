// ─────────────────────────────────────────────────────────────────────────────
// PRICING SEED — Calbayog Memorial Park, PRICE LIST as of JANUARY 2026
// Source: official price sheet, Tel (055) 2091-340.  All values in PHP.
// Interest rates corrected: 1yr = 18%, 2yr = 24%, 3yr = 34%.
// ─────────────────────────────────────────────────────────────────────────────
import { CLASSIFICATION, INSTALLMENT_INTEREST } from '../config/constants'

// Monthly-installment multipliers printed on the sheet (per 1 peso of balance).
export const INSTALLMENT_FACTORS = { '1yr': 0.09168, '2yr': 0.05287, '3yr': 0.04245 }

// Installment plans (II. INSTALLMENT — A. LAWN AREA). areaSqm: 2.5 unless noted.
export const PRICING = {
  [CLASSIFICATION.GARDEN]: {
    classification: CLASSIFICATION.GARDEN, areaSqm: 10,
    pricePerSqm: 19200, totalPrice: 192000, mcf: 3000,
    downPayment30: 57600, cashOutlay: 60600, balance: 134400,
    monthly: { '1yr': 12321.79, '2yr': 7105.73, '3yr': 5705.28 },
  },
  [CLASSIFICATION.REGULAR]: {
    classification: CLASSIFICATION.REGULAR, areaSqm: 2.5,
    pricePerSqm: 18400, totalPrice: 46000, mcf: 3000,
    downPayment30: 13800, cashOutlay: 16800, balance: 32200,
    monthly: { '1yr': 2952.10, '2yr': 1702.41, '3yr': 1366.89 },
  },
  [CLASSIFICATION.DELUXE]: {
    classification: CLASSIFICATION.DELUXE, areaSqm: 2.5,
    pricePerSqm: 19200, totalPrice: 48000, mcf: 3000,
    downPayment30: 14400, cashOutlay: 17400, balance: 33600,
    monthly: { '1yr': 3080.45, '2yr': 1776.43, '3yr': 1426.32 },
  },
  [CLASSIFICATION.PREMIUM]: {
    classification: CLASSIFICATION.PREMIUM, areaSqm: 2.5,
    pricePerSqm: 20800, totalPrice: 52000, mcf: 3000,
    downPayment30: 15600, cashOutlay: 18600, balance: 36400,
    monthly: { '1yr': 3337.15, '2yr': 1924.47, '3yr': 1545.18 },
  },
  [CLASSIFICATION.SPECIAL_REGULAR]: {
    classification: CLASSIFICATION.SPECIAL_REGULAR, areaSqm: 2.5,
    pricePerSqm: 20000, totalPrice: 50000, mcf: 3000,
    downPayment30: 15000, cashOutlay: 18000, balance: 35000,
    monthly: { '1yr': 3208.80, '2yr': 1850.45, '3yr': 1485.75 },
  },
  [CLASSIFICATION.COLUMBARY_1_2]: {
    classification: CLASSIFICATION.COLUMBARY_1_2, areaSqm: null,
    pricePerSqm: null, totalPrice: 32000, mcf: 3000,
    downPayment30: 9600, cashOutlay: 12600, balance: 22400,
    monthly: { '1yr': 2053.63, '2yr': 1184.29, '3yr': 950.88 },
  },
  [CLASSIFICATION.COLUMBARY_3_4]: {
    classification: CLASSIFICATION.COLUMBARY_3_4, areaSqm: null,
    pricePerSqm: null, totalPrice: 35000, mcf: 3000,
    downPayment30: 10500, cashOutlay: 13500, balance: 24500,
    monthly: { '1yr': 2246.16, '2yr': 1295.32, '3yr': 1040.03 },
  },
}

// I. CASH PRICE (Pre-Need) — A. LAWN AREA. "NO DISCOUNT ON PREMIUM PURCHASES".
export const CASH_PRICING = {
  [CLASSIFICATION.REGULAR]: {
    areaSqm: 2.5, pricePerSqm: 18400, totalPrice: 46000, mcf: 3000,
    spotCash: 44400, days30: 45550, days60: 46700, days90: 47850,
  },
  [CLASSIFICATION.PREMIUM]: {
    areaSqm: 2.5, pricePerSqm: 20800, totalPrice: 52000, mcf: 3000,
    spotCash: 55000, days30: null, days60: null, days90: null, noDiscount: true,
  },
}

// Interment fees. Family Estate has separate fresh/bone rates.
export const INTERMENT_FEES = {
  fresh: 3000,
  familyEstate: { fresh: 25000, bone: 15000 },
}

export const PRICING_NOTES = [
  'No discount on premium purchases.',
  'No discount on at-need purchases.',
  'Lawn area lots are 2.5 m² (Garden lots are 10 m²).',
  'MCF (Memorial Care Fund) of ₱3,000 is included in the cash outlay.',
]

// Annual interest rates re-exported for convenience at the consumer screens.
export { INSTALLMENT_INTEREST }