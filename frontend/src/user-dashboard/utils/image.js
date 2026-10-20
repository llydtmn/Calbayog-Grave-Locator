// ─────────────────────────────────────────────────────────────────────────────
// RECEIPT IMAGE HELPERS — used by the GCash receipt upload on the reservation
// form. Photos are shrunk before upload so a phone camera shot (often 5–10 MB)
// doesn't eat the client's mobile data or the storage quota.
// ─────────────────────────────────────────────────────────────────────────────

export const RECEIPT_MAX_MB = 10
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function isReceiptImage(file) {
  return !!file && ALLOWED_TYPES.includes(file.type) && file.size <= RECEIPT_MAX_MB * 1024 * 1024
}

// Resizes to at most `maxDim` px on the longest side and re-encodes as JPEG.
// If the browser can't decode/resize it, the original file is used as-is.
export async function compressReceipt(file, maxDim = 1280, quality = 0.8) {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    return blob || file
  } catch {
    return file
  }
}