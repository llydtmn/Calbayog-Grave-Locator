// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT STATEMENT — download one client's monthly installment history
// (one lot) as a PDF or an Excel file. Used by the history popup in PaymentsTab.
//
// statement = { reservation, progress, rows }   (rows are already sorted)
// Only VERIFIED payments count toward "Total paid"; voided / rejected / pending
// rows are listed for reference and marked.
// The PDF writes "PHP" instead of ₱ because the built-in PDF fonts have no ₱ glyph.
// jspdf and xlsx are loaded on demand, so they don't slow down the admin page.
// ─────────────────────────────────────────────────────────────────────────────
import { formatDate } from './date'
import { INSTALLMENT_PAYMENT_STATUS_META, PAYMENT_METHOD_LABEL, INSTALLMENT_TERM_LABEL } from '../config/paymentStatus'

const money = (n) => 'PHP ' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const day = (d) => formatDate(String(d || '').slice(0, 10))
const lotText = (r) => `${r.blockName || '—'} · Lot ${r.lotNo ?? '—'}`
const typeText = (p) => (p.kind === 'adjustment' ? 'Adjustment' : 'Monthly')
const statusText = (p) => (INSTALLMENT_PAYMENT_STATUS_META[p.status] || INSTALLMENT_PAYMENT_STATUS_META.pending).label
const methodText = (p) => PAYMENT_METHOD_LABEL[p.method] || p.method || '—'
const fileBase = ({ reservation: r }) =>
  `Payment-History_${r.applicantName}_${r.blockName || 'Block'}-Lot${r.lotNo ?? ''}`.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/-+/g, '-')

function summaryPairs({ reservation: r, progress: g }) {
  return [
    ['Client', r.applicantName],
    ['Contact', r.contactNumber || r.email || '—'],
    ['Lot', `${r.blockName || '—'}, Lot ${r.lotNo ?? '—'}`], // no "·": the built-in PDF font drops it
    ['Term', INSTALLMENT_TERM_LABEL[r.installmentTerm] || '—'],
    ['Lot price', money(r.price)],
    ['Monthly amount', money(g.monthly)],
    ['Months paid', `${g.monthsCovered} of ${g.months}`],
    ['Total paid', money(g.paid)],
    ['Remaining balance', money(g.left)],
  ]
}

export async function downloadStatementPdf(statement) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 40

  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(3, 105, 161)
  doc.text('GraveLocator', M, 50)
  doc.setFontSize(12); doc.setTextColor(30, 41, 59)
  doc.text('Monthly Installment — Payment History', M, 70)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 116, 139)
  doc.text(`Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, W - M, 50, { align: 'right' })

  autoTable(doc, {
    startY: 88,
    body: summaryPairs(statement),
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: { top: 3, bottom: 3, left: 6, right: 6 } },
    columnStyles: { 0: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 120 } },
    margin: { left: M, right: M },
  })

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 18,
    head: [['Paid on', 'Type', 'Method', 'Amount', 'Status', 'Note']],
    body: statement.rows.map((p) => [day(p.paidOn), typeText(p), methodText(p), money(p.amount), statusText(p), p.note || '']),
    headStyles: { fillColor: [3, 105, 161], textColor: 255, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 5 },
    columnStyles: { 3: { halign: 'right' } },
    margin: { left: M, right: M },
    didParseCell: (d) => {
      if (d.section === 'head' && d.column.index === 3) d.cell.styles.halign = 'right'
      if (d.section !== 'body') return
      const p = statement.rows[d.row.index]
      if (p && p.status !== 'verified') d.cell.styles.textColor = [148, 163, 184]
    },
  })

  doc.setFontSize(8); doc.setTextColor(100, 116, 139)
  const y = doc.lastAutoTable.finalY + 16
  doc.text('Only verified payments count toward the total paid. Voided, rejected and pending payments are shown for reference.', M, y)

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.text(`Page ${i} of ${pages}`, W - M, doc.internal.pageSize.getHeight() - 24, { align: 'right' })
  }
  doc.save(`${fileBase(statement)}.pdf`)
}

export async function downloadStatementExcel(statement) {
  const XLSX = await import('xlsx')
  const { reservation: r, progress: g, rows } = statement
  const wb = XLSX.utils.book_new()

  const sum = XLSX.utils.aoa_to_sheet([
    ['Monthly Installment — Payment History'],
    [],
    ['Client', r.applicantName],
    ['Contact', r.contactNumber || r.email || ''],
    ['Lot', lotText(r)],
    ['Term', INSTALLMENT_TERM_LABEL[r.installmentTerm] || ''],
    ['Lot price', Number(r.price) || 0],
    ['Monthly amount', g.monthly],
    ['Months paid', `${g.monthsCovered} of ${g.months}`],
    ['Total paid (verified only)', g.paid],
    ['Remaining balance', g.left],
    ['Generated', new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })],
  ])
  sum['!cols'] = [{ wch: 28 }, { wch: 34 }]
  XLSX.utils.book_append_sheet(wb, sum, 'Summary')

  const pay = XLSX.utils.aoa_to_sheet([
    ['Paid on', 'Type', 'Method', 'Amount (PHP)', 'Status', 'Note'],
    ...rows.map((p) => [day(p.paidOn), typeText(p), methodText(p), p.amount, statusText(p), p.note || '']),
  ])
  pay['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, pay, 'Payments')

  // Money cells: show with thousands separators and two decimals.
  for (const [ws, cells] of [[sum, ['B7', 'B8', 'B10', 'B11']], [pay, rows.map((_, i) => `D${i + 2}`)]]) {
    for (const c of cells) if (ws[c]) ws[c].z = '#,##0.00'
  }
  XLSX.writeFile(wb, `${fileBase(statement)}.xlsx`)
}
