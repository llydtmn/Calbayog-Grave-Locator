// ─────────────────────────────────────────────────────────────────────────────
// APP CONSTANTS  (park identity, classifications, env placeholders)
// ─────────────────────────────────────────────────────────────────────────────

export const PARK = {
  name:    'Calbayog Memorial Park',
  tagline: 'Where Love Outlasts a Lifetime',
  address: 'Brgy. Rawis, Calbayog City',
  tel:     '(055) 2091-340',
}

// Lot classifications (price tiers). Keep keys stable; pricing.js is keyed to these.
export const CLASSIFICATION = {
  REGULAR:         'Regular',
  SPECIAL_REGULAR: 'Special Regular',
  DELUXE:          'Deluxe',
  PREMIUM:         'Premium',
  GARDEN:          'Garden',
  COLUMBARY_1_2:   'Columbary 1&2',
  COLUMBARY_3_4:   'Columbary 3&4',
}

export const CLASSIFICATION_ORDER = [
  CLASSIFICATION.REGULAR,
  CLASSIFICATION.SPECIAL_REGULAR,
  CLASSIFICATION.DELUXE,
  CLASSIFICATION.PREMIUM,
  CLASSIFICATION.GARDEN,
  CLASSIFICATION.COLUMBARY_1_2,
  CLASSIFICATION.COLUMBARY_3_4,
]

// Installment annual interest rates (display these next to the monthly figures).
export const INSTALLMENT_INTEREST = {
  '1yr': 0.18, // 18%
  '2yr': 0.24, // 24%
  '3yr': 0.34, // 34%
}

// ── Env placeholders ─────────────────────────────────────────────────────────
// Today the API layer reads from local seed data. When a real backend exists,
// set VITE_API_BASE_URL and flip USE_REMOTE — no screen code needs to change.
export const ENV = {
  API_BASE_URL: import.meta.env?.VITE_API_BASE_URL || '',
  USE_REMOTE:   String(import.meta.env?.VITE_USE_REMOTE || 'false') === 'true',
  // Simulated latency (ms) so the loading states behave like real fetches.
  MOCK_LATENCY: 120,
  // Supabase project config — from Project Settings → API in the Supabase dashboard.
  SUPABASE_URL:      import.meta.env?.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: import.meta.env?.VITE_SUPABASE_ANON_KEY || '',
}