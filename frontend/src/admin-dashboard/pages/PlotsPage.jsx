import { useState, useEffect } from 'react'
import SiteMap from '../components/SiteMap'
import LotGrid from '../components/LotGrid'
import PlotImportModal from '../components/PlotImportModal'
import StatusFilter from '../components/StatusFilter'
import MapLegend from '../components/MapLegend'
import { useBlocks, useLots } from '../hooks'
import { useAdmin } from '../context/AdminContext'
import { statusMeta, statusLabel, STATUS } from '../config/status'
import { intermentMarks } from '../utils/format'
import { plotLabel } from '../utils/plot'
import { downloadPlotWorkbook, deceasedRecordsOf } from '../utils/plotExcel'
import { formatDate } from '../utils/date'

// "d. Mar 4, 2019 · buried Mar 8, 2019"
const lifeLine = (r) => [
  r.deathDate && `d. ${formatDate(r.deathDate)}`,
  r.burialDate && `buried ${formatDate(r.burialDate)}`,
].filter(Boolean).join(' · ')

export default function PlotsPage() {
  const { openModal, plotBlockId: blockId, openPlotBlock, closePlotBlock, notify } = useAdmin()
  const [importOpen, setImportOpen] = useState(false)
  const { blocks } = useBlocks()
  const [filter, setFilter] = useState('all')
  const [selectedLot, setSelectedLot] = useState(null)
  const { lots } = useLots(blockId)

  // Keep the side panel in sync after "Update Status" / "Mark Sold" saves.
  useEffect(() => {
    if (!selectedLot) return
    const fresh = lots.find((l) => l.lotNo === selectedLot.lotNo)
    const namesChanged = JSON.stringify(deceasedRecordsOf(fresh)) !== JSON.stringify(deceasedRecordsOf(selectedLot))
    if (fresh && (fresh.status !== selectedLot.status || fresh.intermentCount !== selectedLot.intermentCount || namesChanged)) setSelectedLot({ ...selectedLot, ...fresh })
  }, [lots, selectedLot])

  const block = blocks.find((b) => b.id === blockId) || null

  // Counts for the status-filter chips (recomputed whenever the block's lots change).
  const counts = { __total: lots.length }
  lots.forEach((l) => { counts[l.status] = (counts[l.status] || 0) + 1 })

  async function exportBlock() {
    try {
      await downloadPlotWorkbook(block, lots)
    } catch (e) {
      notify(e?.message || 'Could not create the Excel file.', 'error')
    }
  }

  const pickBlock = (b) => {
    openPlotBlock(b.id)
    setSelectedLot(null)
    setFilter('all')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Plot Management</h2>
          <p>Tap a block on the map, then a lot in the grid, to view or update it.</p>
        </div>
        <div className="plot-header-actions">
          {block?.hasGrid && (
            <button className="btn btn-ghost" onClick={exportBlock} title="Download this block's lots as an Excel file">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export Excel
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => setImportOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import Excel
          </button>
          <button className="btn btn-primary" onClick={() => openModal('modal-updatelot')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Look Up a Lot
          </button>
        </div>
      </div>

      {importOpen && (
        <PlotImportModal
          blocks={blocks}
          defaultBlockId={blockId || ''}
          onClose={() => { setImportOpen(false); setSelectedLot(null) }}
        />
      )}

      <div className="plot-layout">
        {/* Map / lot grid */}
        <div className="map-container">
          {!block ? (
            <>
              <div className="map-toolbar">
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dgray)' }}>Cemetery Map · Calbayog City — tap a red pin, then “View lots”</span>
              </div>
              <div className="admin-sitemap">
                <SiteMap blocks={blocks} onSelectBlock={pickBlock} />
              </div>
            </>
          ) : (
            <>
              <div className="map-toolbar">
                <button className="btn btn-ghost btn-sm" onClick={() => { closePlotBlock(); setSelectedLot(null) }}>← All Blocks</button>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--charcoal)', marginLeft: 8 }}>
                  {block.name}{block.lawnName ? ` — ${block.lawnName}` : ''}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--dgray)' }}>
                  {block.hasGrid ? `${block.maxLot} lots` : 'Not digitized as a grid yet'}
                </span>
              </div>

              {block.hasGrid ? (
                <div style={{ padding: '10px 16px' }}>
                  <StatusFilter value={filter} onChange={setFilter} counts={counts} />
                  <div className="lg-grid-scroll">
                    <LotGrid blockId={block.id} cols={block.grid?.cols || 0} filter={filter} onSelectLot={setSelectedLot} />
                  </div>
                </div>
              ) : (
                <div className="lg-empty">
                  <div className="lg-empty-icon">🗺️</div>
                  <p style={{ fontSize: 13, color: 'var(--dgray)' }}>
                    This block has no plot data yet. Upload the office's Excel list of lots
                    to create its grid.
                  </p>
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setImportOpen(true)}>
                    Import {block.name} from Excel
                  </button>
                </div>
              )}

              <MapLegend compact />
            </>
          )}
        </div>

        {/* Detail Panel */}
        <div className="plot-detail-panel">
          <div className="plot-detail-card">
            <h3>{selectedLot ? plotLabel({ blockId: selectedLot.blockId, lotNo: selectedLot.lotNo }) : 'Lot Details'}</h3>
            {!selectedLot
              ? <p style={{ fontSize: 13, color: 'var(--dgray)' }}>Select a block, then tap a lot in the grid to view details here.</p>
              : (() => {
                  const meta = statusMeta(selectedLot.status)
                  const marks = intermentMarks(selectedLot.intermentCount)
                  return (
                    <>
                      <div className="detail-row">
                        <span className="detail-label">Lot Number</span>
                        <span className="detail-val">{selectedLot.lotNo ?? '—'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Classification</span>
                        <span className="detail-val">{selectedLot.classification}</span>
                      </div>
                      {marks && (
                        <div className="detail-row">
                          <span className="detail-label">Interments</span>
                          <span className="detail-val">{selectedLot.intermentCount} ({marks})</span>
                        </div>
                      )}
                      {deceasedRecordsOf(selectedLot).length > 0 && (
                        <div className="detail-row" style={{ alignItems: 'flex-start' }}>
                          <span className="detail-label">Deceased</span>
                          <span className="detail-val" style={{ textAlign: 'right' }}>
                            {deceasedRecordsOf(selectedLot).map((r, i) => (
                              <div key={i} style={{ marginBottom: 4 }}>
                                {r.name}
                                {lifeLine(r) && <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--dgray)' }}>{lifeLine(r)}</div>}
                              </div>
                            ))}
                          </span>
                        </div>
                      )}
                      <div className="detail-row">
                        <span className="detail-label">Status</span>
                        <span className="lg-status-pill" style={{ background: meta.fill, color: meta.text, borderColor: meta.border }}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="plot-actions-grid" style={{ marginTop: 16 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openModal('modal-updatelot', { blockId: selectedLot.blockId, lotNo: selectedLot.lotNo, status: selectedLot.status })}
                        >
                          Update Status
                        </button>
                        {selectedLot.status !== STATUS.SOLD && (
                          <button
                            className="btn btn-amber btn-sm"
                            onClick={() => openModal('modal-updatelot', { blockId: selectedLot.blockId, lotNo: selectedLot.lotNo, status: STATUS.SOLD })}
                          >
                            Mark Sold
                          </button>
                        )}
                      </div>
                    </>
                  )
                })()}
          </div>

          {/* Block summary */}
          <div className="plot-detail-card">
            <h3>{block ? `${block.name} Summary` : 'Blocks'}</h3>
            {block
              ? Object.entries(counts).filter(([k]) => k !== '__total').map(([status, n]) => (
                  <div key={status} className="detail-row">
                    <span className="detail-label">{statusLabel(status)}</span>
                    <span className="detail-val">{n}</span>
                  </div>
                ))
              : blocks.map((b) => (
                  <div key={b.id} className="detail-row">
                    <span className="detail-label">{b.name}</span>
                    <span className="detail-val">{b.hasGrid ? `${b.maxLot} lots` : '—'}</span>
                  </div>
                ))}
          </div>
        </div>
      </div>
    </div>
  )
}