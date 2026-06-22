import { useState, useEffect } from 'react'
import { db } from '../firebase.js'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore'

const fmt = (n) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

const TIPI_DEBITO = [
  { id: 'mutuo', label: 'Mutuo', icon: '🏦', colore: 'var(--red)' },
  { id: 'finanziamento_soci', label: 'Finanziamento soci', icon: '👥', colore: 'var(--purple)' },
  { id: 'debito_cantiere', label: 'Debito cantiere', icon: '🏗️', colore: 'var(--orange)' },
  { id: 'altro', label: 'Altro', icon: '📋', colore: 'var(--yellow-bright)' },
]

export default function ContoCorrenteView({ cantieri, soci }) {
  const [saldoCC, setSaldoCC] = useState(0)
  const [debiti, setDebiti] = useState([])
  const [allTx, setAllTx] = useState([])
  const [editingSaldo, setEditingSaldo] = useState(false)
  const [saldoInput, setSaldoInput] = useState('')
  const [modal, setModal] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubs = []
    unsubs.push(onSnapshot(doc(db, 'c_config', 'main'), snap => {
      if (snap.exists()) setSaldoCC(snap.data().saldoCC || 0)
      setLoading(false)
    }))
    unsubs.push(onSnapshot(collection(db, 'c_debiti'), snap => {
      setDebiti(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }))
    unsubs.push(onSnapshot(collection(db, 'c_transazioni'), snap => {
      setAllTx(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }))
    return () => unsubs.forEach(u => u())
  }, [])

  const saveSaldo = async () => {
    const val = parseFloat(saldoInput) || 0
    await setDoc(doc(db, 'c_config', 'main'), { saldoCC: val }, { merge: true })
    setSaldoCC(val)
    setEditingSaldo(false)
  }

  const addDebito = async (data) => { await addDoc(collection(db, 'c_debiti'), data) }
  const updateDebito = async (id, data) => { await updateDoc(doc(db, 'c_debiti', id), data) }
  const deleteDebito = async (id) => {
    if (confirm('Eliminare questo debito?')) await deleteDoc(doc(db, 'c_debiti', id))
  }

  const totEntrate = allTx.filter(t => t.tipo === 'entrata').reduce((s, t) => s + (t.importo || 0), 0)
  const totUscite = allTx.filter(t => t.tipo === 'uscita').reduce((s, t) => s + (t.importo || 0), 0)
  const totDebiti = debiti.reduce((s, d) => s + (d.importoResiduo || 0), 0)
  const flussoCassa = saldoCC + totEntrate - totUscite

  // Separare finanziamento soci dagli altri debiti
  const debitiFinSoci = debiti.filter(d => d.tipo === 'finanziamento_soci')
  const debitiAltri = debiti.filter(d => d.tipo !== 'finanziamento_soci')
  const totFinSoci = debitiFinSoci.reduce((s, d) => s + (d.importoResiduo || 0), 0)

  if (loading) return <Loader />

  return (
    <div>
      <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '18px' }}>💳 Finanze</h2>

      {/* Saldo CC */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px', marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Saldo Conto Corrente</div>
        {editingSaldo ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="number" value={saldoInput} onChange={e => setSaldoInput(e.target.value)} autoFocus style={{ ...INPUT, fontSize: '22px', fontWeight: '700', flex: 1 }} placeholder="0" onKeyDown={e => e.key === 'Enter' && saveSaldo()} />
            <button onClick={saveSaldo} style={{ ...BTN, background: 'var(--green)', color: '#0d1117', padding: '10px 14px' }}>✓</button>
            <button onClick={() => setEditingSaldo(false)} style={{ ...BTN, background: 'var(--bg-card2)', color: 'var(--text)', padding: '10px 14px' }}>✕</button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '34px', fontWeight: '800', color: saldoCC >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(saldoCC)}</div>
            <button onClick={() => { setSaldoInput(String(saldoCC)); setEditingSaldo(true) }} style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 14px', color: 'var(--text-dim)', fontSize: '13px' }}>
              ✏️ Modifica
            </button>
          </div>
        )}
      </div>

      {/* Flusso cassa */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Riepilogo finanziario</div>
        <FlowRow label="Saldo CC" val={saldoCC} color="var(--blue)" />
        <FlowRow label="+ Entrate cantieri" val={totEntrate} color="var(--green)" />
        <FlowRow label="− Uscite cantieri" val={totUscite} color="var(--red)" minus />
        <div style={{ borderTop: '1px solid var(--border)', margin: '10px 0', padding: '10px 0 0' }}>
          <FlowRow label="Flusso netto" val={flussoCassa} color={flussoCassa >= 0 ? 'var(--green)' : 'var(--red)'} big />
        </div>
        <div style={{ borderTop: '1px solid var(--border)', margin: '10px 0', padding: '10px 0 0' }}>
          <FlowRow label="− Debiti totali" val={totDebiti} color="var(--yellow-bright)" minus />
        </div>
        <div style={{ borderTop: '1px solid var(--border)', margin: '10px 0', padding: '10px 0 0' }}>
          <FlowRow label="Posizione netta" val={flussoCassa - totDebiti} color={(flussoCassa - totDebiti) >= 0 ? 'var(--green)' : 'var(--red)'} big />
        </div>
      </div>

      {/* FINANZIAMENTO SOCI - sezione dedicata */}
      <SectionHeader title="👥 Finanziamento Soci" onAdd={() => setModal({ tipo: 'add', tipoDebito: 'finanziamento_soci' })} btnLabel="+ Aggiungi" />
      {debitiFinSoci.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px', marginBottom: '20px' }}>
          Nessun finanziamento soci registrato
        </div>
      ) : (
        <div style={{ marginBottom: '20px' }}>
          {/* Mini riepilogo per socio */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            {soci.map(s => {
              const quota = debitiFinSoci.filter(d => d.sottocategoria === s.nome).reduce((sum, d) => sum + (d.importoResiduo || 0), 0)
              return quota > 0 ? (
                <div key={s.nome} style={{ flex: 1, background: 'var(--bg-card)', border: `1px solid var(--border)`, borderTop: `2px solid ${s.colore}`, borderRadius: '10px', padding: '10px' }}>
                  <div style={{ fontSize: '10px', color: s.colore, fontWeight: '600', marginBottom: '2px' }}>{s.nome}</div>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--purple)' }}>{fmt(quota)}</div>
                </div>
              ) : null
            })}
          </div>
          {debitiFinSoci.map(d => <DebitoCard key={d.id} d={d} onEdit={() => setModal({ tipo: 'edit', data: d })} onDelete={deleteDebito} />)}
          <div style={{ background: 'rgba(188,140,255,0.08)', border: '1px solid rgba(188,140,255,0.3)', borderRadius: '10px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-dim)' }}>Totale finanziamento soci</span>
            <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--purple)' }}>{fmt(totFinSoci)}</span>
          </div>
        </div>
      )}

      {/* ALTRI DEBITI */}
      <SectionHeader title="🏦 Debiti & Passività" onAdd={() => setModal({ tipo: 'add', tipoDebito: 'mutuo' })} btnLabel="+ Aggiungi" />
      {debitiAltri.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)', fontSize: '14px' }}>Nessun debito registrato</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {debitiAltri.map(d => <DebitoCard key={d.id} d={d} onEdit={() => setModal({ tipo: 'edit', data: d })} onDelete={deleteDebito} />)}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <DebitoModal
          debito={modal.data}
          tipoDefault={modal.tipoDebito}
          onClose={() => setModal(null)}
          onSave={modal.tipo === 'edit' ? (data) => updateDebito(modal.data.id, data) : addDebito}
        />
      )}
    </div>
  )
}

function DebitoCard({ d, onEdit, onDelete }) {
  const tipo = TIPI_DEBITO.find(t => t.id === d.tipo) || TIPI_DEBITO[3]
  const totOrig = d.importoTotale || d.importoResiduo || 0
  const pagato = totOrig - (d.importoResiduo || 0)
  const pctPagato = totOrig > 0 ? Math.max(0, Math.min(100, (pagato / totOrig) * 100)) : 0

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: `3px solid ${tipo.colore}`, borderRadius: '12px', padding: '16px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '18px' }}>{tipo.icon}</span>
            <span style={{ fontWeight: '700', fontSize: '15px' }}>{d.descrizione}</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: tipo.colore, background: `${tipo.colore}18`, padding: '2px 8px', borderRadius: '20px' }}>{tipo.label}</span>
            {d.sottocategoria && (
              <span style={{ fontSize: '11px', color: 'var(--text-dim)', background: 'var(--bg-card2)', padding: '2px 8px', borderRadius: '20px' }}>
                📌 {d.sottocategoria}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={onEdit} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '16px', opacity: 0.7 }}>✏️</button>
          <button onClick={() => onDelete(d.id)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '16px', opacity: 0.7 }}>🗑️</button>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '2px' }}>Residuo da pagare</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: tipo.colore }}>{fmt(d.importoResiduo)}</div>
        </div>
        {totOrig !== d.importoResiduo && totOrig > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '2px' }}>Già pagato</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--green)' }}>{fmt(pagato)}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>di {fmt(totOrig)}</div>
          </div>
        )}
      </div>
      {totOrig > 0 && pctPagato > 0 && (
        <>
          <div style={{ background: 'var(--bg-card2)', borderRadius: '4px', height: '6px', overflow: 'hidden', marginBottom: '4px' }}>
            <div style={{ width: `${pctPagato}%`, height: '100%', background: 'var(--green)', borderRadius: '4px' }} />
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{pctPagato.toFixed(0)}% saldato</div>
        </>
      )}
      {d.note && <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontStyle: 'italic', marginTop: '8px' }}>{d.note}</div>}
    </div>
  )
}

function DebitoModal({ debito, tipoDefault, onClose, onSave }) {
  const [form, setForm] = useState({
    tipo: debito?.tipo || tipoDefault || 'mutuo',
    descrizione: debito?.descrizione || '',
    sottocategoria: debito?.sottocategoria || '',
    importoTotale: debito?.importoTotale || '',
    importoResiduo: debito?.importoResiduo || '',
    note: debito?.note || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.descrizione.trim() || !form.importoResiduo) return
    setSaving(true)
    try {
      const importoResiduo = parseFloat(form.importoResiduo) || 0
      const importoTotale = parseFloat(form.importoTotale) || importoResiduo
      await onSave({ tipo: form.tipo, descrizione: form.descrizione.trim(), sottocategoria: form.sottocategoria.trim(), importoTotale, importoResiduo, note: form.note.trim() })
      onClose()
    } finally { setSaving(false) }
  }

  const tipoCorrente = TIPI_DEBITO.find(t => t.id === form.tipo)

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', zIndex: 300 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', padding: '24px 20px', width: '100%', maxWidth: '600px', margin: '0 auto', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>{debito ? '✏️ Modifica' : '➕ Nuovo'} debito</h3>

        <Label>Tipo</Label>
        <select value={form.tipo} onChange={e => set('tipo', e.target.value)} style={INPUT}>
          {TIPI_DEBITO.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
        </select>

        <Label>Descrizione *</Label>
        <input value={form.descrizione} onChange={e => set('descrizione', e.target.value)} style={INPUT} placeholder={`Es. ${tipoCorrente?.label} principale`} />

        <Label>Sottocategoria / Etichetta</Label>
        <input value={form.sottocategoria} onChange={e => set('sottocategoria', e.target.value)} style={INPUT}
          placeholder={form.tipo === 'finanziamento_soci' ? 'Es. Chiara / Damiano / Valentina' : 'Es. Cantiere MSR / Banca XYZ / Rata 2024'} />
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
          Campo libero per organizzare meglio i debiti della stessa categoria
        </div>

        <Label>Importo originale totale (€)</Label>
        <input type="number" value={form.importoTotale} onChange={e => set('importoTotale', e.target.value)} style={INPUT} placeholder="Lascia vuoto se uguale al residuo" />

        <Label>Importo residuo da pagare (€) *</Label>
        <input type="number" value={form.importoResiduo} onChange={e => set('importoResiduo', e.target.value)} style={INPUT} placeholder="0" />

        <Label>Note</Label>
        <input value={form.note} onChange={e => set('note', e.target.value)} style={INPUT} placeholder="Note aggiuntive..." />

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button onClick={onClose} style={{ ...BTN, background: 'var(--bg-card2)', color: 'var(--text)', flex: 1 }}>Annulla</button>
          <button onClick={save} disabled={saving} style={{ ...BTN, background: 'var(--red)', color: '#fff', flex: 2, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvataggio...' : debito ? 'Aggiorna' : 'Aggiungi'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FlowRow({ label, val, color, big, minus }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
      <span style={{ fontSize: big ? '14px' : '13px', color: big ? 'var(--text)' : 'var(--text-dim)', fontWeight: big ? '700' : '400' }}>{label}</span>
      <span style={{ fontSize: big ? '18px' : '15px', fontWeight: big ? '800' : '600', color }}>{minus ? fmt(val) : fmt(val)}</span>
    </div>
  )
}

function SectionHeader({ title, onAdd, btnLabel }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', marginTop: '4px' }}>
      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>{title}</div>
      <button onClick={onAdd} style={{ ...BTN, background: 'var(--bg-card2)', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: '12px', padding: '6px 12px' }}>{btnLabel}</button>
    </div>
  )
}

function Label({ children }) {
  return <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '14px', marginBottom: '6px' }}>{children}</div>
}

function Loader() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: '50px', color: 'var(--text-dim)' }}>Caricamento...</div>
}

const BTN = { padding: '11px 18px', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: '600' }
const INPUT = { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '15px' }
