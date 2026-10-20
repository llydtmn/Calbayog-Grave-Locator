// ─────────────────────────────────────────────────────────────────────────────
// MEMORIAL MODERATION QUEUE — admin's view of memorial submissions (including
// ones not yet public). Starts EMPTY — no demo submissions.
// Shape: { id, name, submittedBy, blockId, lotNo, birth, death, submitted, status }
// ─────────────────────────────────────────────────────────────────────────────
export const MEMORIAL_QUEUE = []

export const getMemorialQueueById = (id) => MEMORIAL_QUEUE.find((m) => m.id === id) || null