// ─────────────────────────────────────────────────────────────────────────────
// PlotImportModal — Plot Management → "Import Excel".
//   1. Pick an .xlsx / .xls / .csv file (and a default block for files that
//      have no Block column).
//   2. Preview: per block, how many lots are new / updated / unchanged, any
//      rows with errors, and lots with active reservations that would change.
//   3. Import: each block is saved in one transaction (admin_import_lots).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import * as api from '../api'
import { useAdmin } from '../context/AdminContext'
import { readPlotFile, buildImportPlan, downloadPlotWorkbook } from '../utils/plotExcel'

const MAX_LIST = 40

export default function PlotImportModal({ blocks, defaultBlockId, onClose }) {
  const { notify } = useAdmin()
  const [blockId, setBlockId] = useState(defaultBlockId || '')
  const [file, setFile] = useState(null)
  const [step, setStep] = useState('pick')        // pick | preview | saving
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState(null)          // { plans, errors }
  const [replace, setReplace] = useState(false)
  const [cols, setCols] = useState({})            // { [blockId]: '12' }

  const close = () => { if (!busy) onClose() }

  async function analyse() {
    if (!file) { setError('Choose an Excel file first.'); return }
    setBusy(true); setError('')
    try {
      const { rows, errors: readErrors, sheets } = await readPlotFile(file, blocks, blockId)
      if (!sheets.length) throw new Error('No sheet with a "Lot No" and "Status" header was found. Download the template to see the expected columns.')
      if (!rows.length && !readErrors.length) throw new Error('The file has the right headers but no lot rows.')

      const blockIds = [...new Set(rows.map((r) => r.blockId))]
      const [existingLists, reservedIds] = await Promise.all([
        Promise.all(blockIds.map((id) => api.getLots(id))),
        api.getActiveReservedLotIds(blockIds).catch(() => new Set()),
      ])
      const existingByBlock = Object.fromEntries(blockIds.map((id, i) => [id, existingLists[i]]))
      const built = buildImportPlan(rows, blocks, existingByBlock, reservedIds)
      built.errors = [...readErrors, ...built.errors]
      setPlan(built)
      setCols(Object.fromEntries(built.plans.map((p) => [p.blockId, p.block?.grid?.cols ? String(p.block.grid.cols) : ''])))
      setStep('preview')
    } catch (e) {
      setError(e?.message || 'Could not read that file.')
    } finally {
      setBusy(false)
    }
  }

  async function runImport() {
    setBusy(true); setStep('saving'); setError('')
    const done = []
    try {
      for (const p of plan.plans) {
        if (!p.rows.length) continue
        const res = await api.importLots(p.blockId, p.rows, { replace, gridCols: cols[p.blockId] })
        done.push(`${p.block?.name || p.blockId}: ${res?.inserted ?? 0} new, ${res?.updated ?? 0} updated${replace ? `, ${res?.deleted ?? 0} removed` : ''}${res?.datesSaved ? `, ${res.datesSaved} with new dates` : ''}`)
      }
      notify(`Plots imported — ${done.join(' · ')}`)
      onClose()
    } catch (e) {
      setError(`${done.length ? `Saved: ${done.join(' · ')}. ` : ''}Stopped at the next block: ${e?.message || 'import failed.'}`)
      setStep('preview')
    } finally {
      setBusy(false)
    }
  }

  async function template() {
    const block = blocks.find((b) => b.id === blockId) || null
    try {
      const lots = block ? await api.getLots(block.id) : []
      await downloadPlotWorkbook(block, lots)
    } catch (e) {
      setError(e?.message || 'Could not create the Excel file.')
    }
  }

  const totals = plan
    ? plan.plans.reduce((t, p) => ({ rows: t.rows + p.rows.length, added: t.added + p.added, changed: t.changed + p.changed, removable: t.removable + p.removable }), { rows: 0, added: 0, changed: 0, removable: 0 })
    : null
  const warnings = plan ? plan.plans.flatMap((p) => p.warnings.map((w) => `${p.block?.name || p.blockId} · ${w}`)) : []
  const repeats = plan?.repeats || { conflicts: [], identical: 0 }
  const changeCount = totals ? totals.added + totals.changed + (replace ? totals.removable : 0) : 0
  const colsChanged = plan ? plan.plans.some((p) => String(cols[p.blockId] || '') !== String(p.block?.grid?.cols || '')) : false
  const importLabel = changeCount > 0
    ? `Import ${changeCount} change${changeCount === 1 ? '' : 's'}`
    : colsChanged ? 'Save grid columns' : 'Import anyway (no lot changes)'

  return (
    <div className="modal-overlay open" onClick={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="modal imp-modal">
        <h3>Import Plots from Excel</h3>
        <p>
          Add lots to blocks that have no data yet, or update existing lots. Columns:
          <strong> Block, Lot No, Classification, Status, Interments, Name of Deceased 1, 2…</strong>
          {' '}(optional: <strong>Date of Death 1, 2…</strong> and <strong>Date of Burial 1, 2…</strong>)
          {' '}— the office's Sales Control sheet (Lot No., Class, Buyer's Name, W/ Interment, Name of Deceased) works as-is.
        </p>

        {error && <div className="pay-note pay-note-err imp-note">{error}</div>}

        {step === 'pick' && (
          <>
            <label className={`imp-drop${file ? ' has-file' : ''}`}>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={(e) => { setFile(e.target.files?.[0] || null); setError('') }}
              />
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13l3 4M11 13l-3 4M14 13h3M14 17h3"/></svg>
              <span className="imp-drop-title">{file ? file.name : 'Choose an Excel file'}</span>
              <span className="imp-drop-sub">{file ? `${(file.size / 1024).toFixed(0)} KB · click to change` : '.xlsx, .xls or .csv'}</span>
            </label>

            <div className="modal-field">
              <label>Block (used when the file has no Block column)</label>
              <select value={blockId} onChange={(e) => setBlockId(e.target.value)}>
                <option value="">— Read the block from the file —</option>
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}{b.lawnName ? ` — ${b.lawnName}` : ''}{b.hasGrid ? '' : ' (no plot data yet)'}</option>
                ))}
              </select>
            </div>

            <button type="button" className="imp-link" onClick={template}>
              ⬇ {blockId && blocks.find((b) => b.id === blockId)?.hasGrid ? 'Download this block as Excel (edit it, then import it back)' : 'Download a blank template'}
            </button>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={close} disabled={busy}>Cancel</button>
              <button className="btn btn-primary" onClick={analyse} disabled={busy || !file}>{busy ? 'Reading…' : 'Preview Import'}</button>
            </div>
          </>
        )}

        {(step === 'preview' || step === 'saving') && plan && (
          <>
            <div className="imp-summary">
              <div><strong>{totals.rows}</strong><span>rows</span></div>
              <div className="imp-new"><strong>{totals.added}</strong><span>new lots</span></div>
              <div className="imp-upd"><strong>{totals.changed}</strong><span>updated</span></div>
              <div className={plan.errors.length ? 'imp-err' : ''}><strong>{plan.errors.length}</strong><span>skipped</span></div>
            </div>

            {plan.plans.length > 0 && (
              <div className="table-wrap imp-table">
                <table>
                  <thead>
                    <tr>
                      <th>Block</th>
                      <th>In file</th>
                      <th>New</th>
                      <th>Updated</th>
                      <th>Same</th>
                      <th title="Lots that will have names of the deceased">Names</th>
                      <th title="Lots saved now but not in the file">Not in file</th>
                      <th title="How many lots per row in the grid. Blank = fit to screen.">Grid cols</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.plans.map((p) => (
                      <tr key={p.blockId}>
                        <td>
                          <strong>{p.block?.name || p.blockId}</strong>
                          {!p.block?.hasGrid && <div className="pay-sub">No plot data yet</div>}
                        </td>
                        <td>{p.rows.length}</td>
                        <td className="imp-new">{p.added}</td>
                        <td className="imp-upd">{p.changed}</td>
                        <td>{p.same}</td>
                        <td>{p.withNames}</td>
                        <td>
                          {p.missing}
                          {replace && p.missing > 0 && (
                            <div className="pay-sub">{p.removable} removed{p.protectedCount ? `, ${p.protectedCount} kept (reserved)` : ''}</div>
                          )}
                        </td>
                        <td>
                          <input
                            className="imp-cols"
                            type="number" min="1" max="60" placeholder="auto"
                            value={cols[p.blockId] ?? ''}
                            onChange={(e) => setCols({ ...cols, [p.blockId]: e.target.value })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <label className="imp-check">
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
              <span>
                <strong>Replace the whole block</strong> — remove lots that are not in the file.
                Leave unchecked to only add and update the lots listed in the file.
              </span>
            </label>

            {warnings.length > 0 && (
              <details className="imp-list imp-warn" open>
                <summary>{warnings.length} lot{warnings.length > 1 ? 's' : ''} with an active reservation will change</summary>
                <ul>{warnings.slice(0, MAX_LIST).map((w, i) => <li key={i}>{w}</li>)}</ul>
                {warnings.length > MAX_LIST && <div className="pay-sub">…and {warnings.length - MAX_LIST} more</div>}
              </details>
            )}

            {(repeats.conflicts.length > 0 || repeats.identical > 0) && (
              <details className="imp-list imp-warn" open={repeats.conflicts.length > 0 && repeats.conflicts.length <= 10}>
                <summary>
                  {repeats.conflicts.length > 0
                    ? `${repeats.conflicts.length} lot${repeats.conflicts.length > 1 ? 's are' : ' is'} listed more than once with different details — the last row is used`
                    : `${repeats.identical} repeated row${repeats.identical > 1 ? 's' : ''} with the same details were ignored`}
                </summary>
                {repeats.conflicts.length > 0 && (
                  <ul>
                    {repeats.conflicts.slice(0, MAX_LIST).map((c) => (
                      <li key={`${c.block}-${c.lotNo}`}><strong>{c.block} · Lot {c.lotNo}:</strong> {c.wheres.length}× ({c.wheres.map((w) => w.replace(/^.* row /, 'row ')).join(', ')}) — using {c.used.replace(/^.* row /, 'row ')}</li>
                    ))}
                  </ul>
                )}
                {repeats.conflicts.length > MAX_LIST && <div className="pay-sub">…and {repeats.conflicts.length - MAX_LIST} more</div>}
                {repeats.conflicts.length > 0 && repeats.identical > 0 && <div className="pay-sub">{repeats.identical} other repeated rows had the same details and were ignored.</div>}
              </details>
            )}

            {plan.errors.length > 0 && (
              <details className="imp-list imp-errors" open={plan.errors.length <= 10}>
                <summary>{plan.errors.length} row{plan.errors.length > 1 ? 's' : ''} will be skipped — fix them in Excel and import again</summary>
                <ul>{plan.errors.slice(0, MAX_LIST).map((er, i) => <li key={i}><strong>{er.where}:</strong> {er.message}</li>)}</ul>
                {plan.errors.length > MAX_LIST && <div className="pay-sub">…and {plan.errors.length - MAX_LIST} more</div>}
              </details>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setStep('pick'); setPlan(null); setError('') }} disabled={busy}>Back</button>
              <button className="btn btn-primary" onClick={runImport} disabled={busy || !plan.plans.length}>
                {step === 'saving' ? 'Importing…' : importLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}