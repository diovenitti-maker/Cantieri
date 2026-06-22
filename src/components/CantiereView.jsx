import { useState, useEffect } from 'react'
import { db } from '../firebase.js'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, query, where, serverTimestamp
} from 'firebase/firestore'

const fmt = (n) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

const fmtDate = (ts) => {
  if (!ts) return ''
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })
  } catch { return '' }
}

export const CATEGORIE_USCITE = [
  { id: 'lavori', label: 'Lavori cantiere', icon: '🔨', colore: 'var(--blue)' },
  { id: 'terreno', label: 'Terreno & Burocrazia', icon: '📋', colore: 'var(--yellow-bright)' },
  { id: 'massimo', label: 'Massimo', sublabel: 'gestione cantiere', icon: '👷', colore: 'var(--orange)' },
  { id: 'damiano', label: 'Damiano', sublabel: 'tecnico', icon: '📐', colore: 'var(--cyan)' },
  { id: 'alessandro', label: 'Alessandro', sublabel: 'agenzia', icon: '🤝', colore: 'var(--green)' },
]

const STATO_CONFIG = {
  disponibile: { label: 'Disponibile', icon: '🟢', colore: 'var(--green)', bg: 'rgba(63,185,80,0.12)' },
  compromesso: { label: 'Compromesso', icon: '🟡', colore: 'var(--yellow-bright)', bg: 'rgba(211,153,34,0.12)' },
  rogitato: { label: 'Rogitato', icon: '✅', colore: 'var(--blue)', bg: 'rgba(88,166,255,0.12)' },
}

export default function CantiereView({ cantiere, soci }) {
  const [tab, setTab] = useState('riepilogo')
  const [transazioni, setTransazioni] = useState([])
  const [unita, setUnita] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // { tipo: 'entrata'|'uscita'|'unita_edit', data? }

  useEffect(() => {
    setLoading(true)
    setTab('riepilogo')
    const unsubs = []

    const qTx = query(collection(db, 'c_transazioni'), where('cantiereId', '==', cantiere.id))
    unsubs.push(onSnapshot(qTx, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      docs.sort((a, b) => {
        const ta = a.data?.toMillis?.() || (a.data instanceof Date ? a.data.getTime() : 0)
        const tb = b.data?.toMillis?.() || (b.data instanceof Date ? b.data.getTime() : 0)
        return tb - ta
      })
      setTransazioni(docs)
      setLoading(false)
    }))

    const qU = query(collection(db, 'c_unita'), where('cantiereId', '==', cantiere.id))
    unsubs.push(onSnapshot(qU, snap => {
      setUnita(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'it', { numeric: true })))
    }))

    return () => unsubs.forEach(u => u())
  }, [cantiere.id])

  const entrate = transazioni.filter(t => t.tipo === 'entrata').reduce((s, t) => s + (t.importo || 0), 0)
  const uscite = transazioni.filter(t => t.tipo === 'uscita').reduce((s, t) => s + (t.importo || 0), 0)
  const guadagno = entrate - uscite
  const rendimento = uscite > 0 ? (guadagno / uscite) * 100 : 0

  const addTx = async (data) => {
    await addDoc(collection(db, 'c_transazioni'), { ...data, cantiereId: cantiere.id, createdAt: serverTimestamp() })
  }
  const deleteTx = async (id) => {
    if (confirm('Eliminare questa voce?')) await deleteDoc(doc(db, 'c_transazioni', id))
  }
  const updateUnita = async (id, data) => {
    await updateDoc(doc(db, 'c_unita', id), data)
  }
  const addUnita = async (nome) => {
    await addDoc(collection(db, 'c_unita'), { cantiereId: cantiere.id, nome, stato: 'disponibile', prezzoListino: 0 })
  }
  const initUnita = async () => {
    const names = Array.from({ length: cantiere.numUnita }, (_, i) => {
      const n = i + 1
      return `${cantiere.tipoUnita} ${cantiere.numUnita > 9 ? String(n).padStart(2, '0') : n}`
    })
    await Promise.all(names.map(nome => addDoc(collection(db, 'c_unita'), { cantiereId: cantiere.id, nome, stato: 'disponibile', prezzoListino: 0 })))
  }

  const TABS = [
    { id: 'riepilogo', label: 'Riepilogo', icon: '📊' },
    { id: 'unita', label: 'Unità', icon: cantiere.tipoUnita === 'Villetta' ? '🏡' : '🏢' },
    { id: 'entrate', label: 'Entrate', icon: '💚' },
    { id: 'uscite', label: 'Uscite', icon: '💸' },
  ]

  return (
    <div>
      {/* Header cantiere */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: cantiere.colore }}>{cantiere.nome}</h2>
            <RendBadge val={rendimento} />
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>{cantiere.descrizione}</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '4px',
        gap: '2px',
        marginBottom: '18px',
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1,
            padding: '8px 2px',
            background: tab === t.id ? cantiere.colore : 'transparent',
            color: tab === t.id ? (cantiere.colore === 'var(--yellow-bright)' ? '#000' : '#0d1117') : 'var(--text-dim)',
            border: 'none',
            borderRadius: '7px',
            fontWeight: tab === t.id ? '700' : '400',
            fontSize: '11px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            transition: 'all 0.15s',
          }}>
            <span style={{ fontSize: '16px' }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <Loader />}

      {!loading && tab === 'riepilogo' && (
        <RiepilogoTab
          entrate={entrate} uscite={uscite} guadagno={guadagno} rendimento={rendimento}
          transazioni={transazioni} soci={soci} cantiere={cantiere}
        />
      )}
      {!loading && tab === 'unita' && (
        <UnitaTab
          unita={unita} cantiere={cantiere}
          updateUnita={updateUnita} addUnita={addUnita} initUnita={initUnita}
          onEdit={(u) => setModal({ tipo: 'unita_edit', data: u })}
        />
      )}
      {!loading && tab === 'entrate' && (
        <TxTab
          items={transazioni.filter(t => t.tipo === 'entrata')}
          color="var(--green)"
          label="entrate"
          onAdd={() => setModal({ tipo: 'entrata' })}
          onDelete={deleteTx}
        />
      )}
      {!loading && tab === 'uscite' && (
        <UsciteTab
          items={transazioni.filter(t => t.tipo === 'uscita')}
          onAdd={() => setModal({ tipo: 'uscita' })}
          onDelete={deleteTx}
        />
      )}

      {/* Modals */}
      {modal?.tipo === 'entrata' && (
        <AddTxModal tipo="entrata" onClose={() => setModal(null)} onSave={addTx} />
      )}
      {modal?.tipo === 'uscita' && (
        <AddTxModal tipo="uscita" onClose={() => setModal(null)} onSave={addTx} />
      )}
      {modal?.tipo === 'unita_edit' && (
        <UnitaEditModal unita={modal.data} onClose={() => setModal(null)} onSave={updateUnita} />
      )}
    </div>
  )
}

/* ─── RIEPILOGO TAB ─── */
function RiepilogoTab({ entrate, uscite, guadagno, rendimento, transazioni, soci, cantiere }) {
  const uscitePerCat = CATEGORIE_USCITE.map(cat => ({
    ...cat,
    totale: transazioni.filter(t => t.tipo === 'uscita' && t.categoria === cat.id).reduce((s, t) => s + (t.importo || 0), 0),
  }))
  const totUscite = uscitePerCat.reduce((s, c) => s + c.totale, 0)

  return (
    <div>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
        <KpiCard label="Entrate" val={fmt(entrate)} color="var(--green)" bg="rgba(63,185,80,0.08)" />
        <KpiCard label="Uscite" val={fmt(uscite)} color="var(--red)" bg="rgba(248,81,73,0.08)" />
      </div>
      <div style={{
        background: 'var(--bg-card)',
        border: `1px solid ${guadagno >= 0 ? 'rgba(63,185,80,0.3)' : 'rgba(248,81,73,0.3)'}`,
        borderRadius: '12px',
        padding: '18px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '4px' }}>Guadagno cantiere</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: guadagno >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(guadagno)}</div>
        </div>
        <RendBadge val={rendimento} big />
      </div>

      {/* Uscite per categoria */}
      <Section title="Uscite per categoria">
        {uscitePerCat.map(cat => {
          const pct = totUscite > 0 ? (cat.totale / totUscite) * 100 : 0
          return (
            <div key={cat.id} style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '8px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>{cat.icon}</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: cat.colore }}>{cat.label}</div>
                    {cat.sublabel && <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{cat.sublabel}</div>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: cat.totale > 0 ? 'var(--red)' : 'var(--text-dim)' }}>{fmt(cat.totale)}</div>
                  {pct > 0 && <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{pct.toFixed(0)}%</div>}
                </div>
              </div>
              {cat.totale > 0 && (
                <div style={{ background: 'var(--bg-card2)', borderRadius: '3px', height: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: cat.colore, borderRadius: '3px', transition: 'width 0.5s ease' }} />
                </div>
              )}
            </div>
          )
        })}
      </Section>

      {/* Quota soci */}
      <Section title="Quote soci">
        {soci.map(s => (
          <div key={s.nome} style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '14px 16px',
            marginBottom: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: `${s.colore}25`,
                border: `2px solid ${s.colore}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: '700', color: s.colore,
              }}>{s.pct}%</div>
              <span style={{ fontWeight: '600', fontSize: '15px' }}>{s.nome}</span>
            </div>
            <span style={{ fontSize: '18px', fontWeight: '800', color: guadagno >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {fmt(guadagno * s.pct / 100)}
            </span>
          </div>
        ))}
      </Section>
    </div>
  )
}

/* ─── UNITÀ TAB ─── */
function UnitaTab({ unita, cantiere, updateUnita, addUnita, initUnita, onEdit }) {
  const disponibili = unita.filter(u => u.stato === 'disponibile').length
  const compromessi = unita.filter(u => u.stato === 'compromesso').length
  const rogitati = unita.filter(u => u.stato === 'rogitato').length
  const totVenduto = unita.filter(u => u.stato === 'rogitato').reduce((s, u) => s + (u.prezzoVendita || 0), 0)
  const totListino = unita.reduce((s, u) => s + (u.prezzoListino || 0), 0)

  if (unita.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 20px' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>{cantiere.tipoUnita === 'Villetta' ? '🏡' : '🏢'}</div>
        <div style={{ color: 'var(--text-dim)', marginBottom: '20px', fontSize: '14px' }}>
          Nessuna unità configurata
        </div>
        <button onClick={initUnita} style={{ ...BTN, background: cantiere.colore, color: '#0d1117', fontWeight: '700' }}>
          Inizializza {cantiere.numUnita} {cantiere.tipoUnita === 'Villetta' ? 'Villette' : 'Appartamenti'}
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
        {[
          { label: 'Disponibili', n: disponibili, color: 'var(--green)' },
          { label: 'Compromessi', n: compromessi, color: 'var(--yellow-bright)' },
          { label: 'Rogitati', n: rogitati, color: 'var(--blue)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '26px', fontWeight: '800', color: s.color }}>{s.n}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
          Listino: <strong style={{ color: 'var(--text)' }}>{fmt(totListino)}</strong>
          {totVenduto > 0 && <> · Venduto: <strong style={{ color: 'var(--green)' }}>{fmt(totVenduto)}</strong></>}
        </div>
        <button
          onClick={async () => {
            const nome = prompt(`Nome nuova unità (es. ${cantiere.tipoUnita} ${unita.length + 1}):`)
            if (nome?.trim()) await addUnita(nome.trim())
          }}
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 12px', color: 'var(--text-dim)', fontSize: '12px' }}
        >
          + Aggiungi
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {unita.map(u => {
          const stato = STATO_CONFIG[u.stato || 'disponibile']
          return (
            <div key={u.id} onClick={() => onEdit(u)} style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '14px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
            }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '2px' }}>{u.nome}</div>
                {u.acquirente && <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>👤 {u.acquirente}</div>}
                {u.note && <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontStyle: 'italic' }}>{u.note}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  background: stato.bg, color: stato.colore,
                  padding: '3px 10px', borderRadius: '20px',
                  fontSize: '12px', fontWeight: '600', marginBottom: '4px',
                }}>
                  {stato.icon} {stato.label}
                </div>
                {u.prezzoVendita > 0 && (
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--green)' }}>{fmt(u.prezzoVendita)}</div>
                )}
                {!u.prezzoVendita && u.prezzoListino > 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{fmt(u.prezzoListino)}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── TRANSAZIONI TAB (ENTRATE) ─── */
function TxTab({ items, color, label, onAdd, onDelete }) {
  const totale = items.reduce((s, t) => s + (t.importo || 0), 0)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Totale {label}</div>
          <div style={{ fontSize: '26px', fontWeight: '800', color }}>{fmt(totale)}</div>
        </div>
        <button onClick={onAdd} style={{ ...BTN, background: color, color: '#0d1117' }}>+ Aggiungi</button>
      </div>
      {items.length === 0
        ? <Empty msg={`Nessuna ${label.slice(0, -1)} registrata`} />
        : items.map(t => (
          <TxRow key={t.id} t={t} color={color} onDelete={onDelete} />
        ))
      }
    </div>
  )
}

/* ─── USCITE TAB ─── */
function UsciteTab({ items, onAdd, onDelete }) {
  const [filterCat, setFilterCat] = useState('all')
  const totale = items.reduce((s, t) => s + (t.importo || 0), 0)
  const filtered = filterCat === 'all' ? items : items.filter(t => t.categoria === filterCat)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Totale uscite</div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--red)' }}>{fmt(totale)}</div>
        </div>
        <button onClick={onAdd} style={{ ...BTN, background: 'var(--red)', color: '#fff' }}>+ Aggiungi</button>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '14px' }}>
        <Chip label="Tutte" active={filterCat === 'all'} onClick={() => setFilterCat('all')} />
        {CATEGORIE_USCITE.map(c => (
          <Chip key={c.id} label={`${c.icon} ${c.label.split(' ')[0]}`} active={filterCat === c.id} color={c.colore} onClick={() => setFilterCat(c.id)} />
        ))}
      </div>

      {/* Mini bar chart when all */}
      {filterCat === 'all' && totale > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
          {CATEGORIE_USCITE.map(cat => {
            const tot = items.filter(t => t.categoria === cat.id).reduce((s, t) => s + (t.importo || 0), 0)
            if (!tot) return null
            const pct = (tot / totale) * 100
            return (
              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', minWidth: '20px' }}>{cat.icon}</span>
                <span style={{ fontSize: '11px', color: cat.colore, minWidth: '100px' }}>{cat.label}</span>
                <div style={{ flex: 1, background: 'var(--bg-card2)', borderRadius: '3px', height: '6px' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: cat.colore, borderRadius: '3px' }} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: '600', minWidth: '60px', textAlign: 'right' }}>{fmt(tot)}</span>
              </div>
            )
          })}
        </div>
      )}

      {filtered.length === 0
        ? <Empty msg="Nessuna uscita registrata" />
        : filtered.map(t => {
          const cat = CATEGORIE_USCITE.find(c => c.id === t.categoria)
          return <TxRow key={t.id} t={t} color="var(--red)" onDelete={onDelete} cat={cat} />
        })
      }
    </div>
  )
}

function TxRow({ t, color, onDelete, cat }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      padding: '13px 14px',
      marginBottom: '8px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '3px' }}>{t.descrizione}</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {cat && (
            <span style={{
              fontSize: '10px', color: cat.colore,
              background: `${cat.colore}18`,
              padding: '2px 7px', borderRadius: '20px',
            }}>{cat.icon} {cat.label}</span>
          )}
          {t.data && <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{fmtDate(t.data)}</span>}
        </div>
        {t.note && <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontStyle: 'italic', marginTop: '4px' }}>{t.note}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '10px' }}>
        <span style={{ fontWeight: '700', color, fontSize: '15px', whiteSpace: 'nowrap' }}>{fmt(t.importo)}</span>
        <button onClick={() => onDelete(t.id)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '16px', padding: '4px', opacity: 0.6 }}>🗑️</button>
      </div>
    </div>
  )
}

/* ─── ADD TX MODAL ─── */
function AddTxModal({ tipo, onClose, onSave }) {
  const [form, setForm] = useState({
    descrizione: '',
    importo: '',
    categoria: tipo === 'uscita' ? 'lavori' : 'vendita',
    data: new Date().toISOString().split('T')[0],
    note: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.descrizione.trim() || !form.importo) return
    setSaving(true)
    try {
      await onSave({
        tipo,
        descrizione: form.descrizione.trim(),
        importo: parseFloat(form.importo),
        categoria: form.categoria,
        data: new Date(form.data),
        note: form.note.trim(),
      })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <ModalShell onClose={onClose}>
      <h3 style={{ ...MODAL_TITLE }}>{tipo === 'entrata' ? '💚 Nuova Entrata' : '💸 Nuova Uscita'}</h3>

      {tipo === 'uscita' && (
        <>
          <Label>Categoria</Label>
          <select value={form.categoria} onChange={e => set('categoria', e.target.value)} style={INPUT}>
            {CATEGORIE_USCITE.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}{c.sublabel ? ` (${c.sublabel})` : ''}</option>)}
          </select>
        </>
      )}

      <Label>Descrizione *</Label>
      <input value={form.descrizione} onChange={e => set('descrizione', e.target.value)} style={INPUT} placeholder="Es. SAL 1 impresa costruzioni" />

      <Label>Importo (€) *</Label>
      <input type="number" value={form.importo} onChange={e => set('importo', e.target.value)} style={INPUT} placeholder="0" min="0" step="any" />

      <Label>Data</Label>
      <input type="date" value={form.data} onChange={e => set('data', e.target.value)} style={INPUT} />

      <Label>Note</Label>
      <input value={form.note} onChange={e => set('note', e.target.value)} style={INPUT} placeholder="Note aggiuntive..." />

      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button onClick={onClose} style={{ ...BTN, background: 'var(--bg-card2)', color: 'var(--text)', flex: 1 }}>Annulla</button>
        <button onClick={save} disabled={saving} style={{ ...BTN, background: tipo === 'entrata' ? 'var(--green)' : 'var(--red)', color: tipo === 'entrata' ? '#0d1117' : '#fff', flex: 2, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Salvataggio...' : 'Salva'}
        </button>
      </div>
    </ModalShell>
  )
}

/* ─── UNITÀ EDIT MODAL ─── */
function UnitaEditModal({ unita, onClose, onSave }) {
  const [form, setForm] = useState({
    stato: unita.stato || 'disponibile',
    prezzoListino: unita.prezzoListino || '',
    acquirente: unita.acquirente || '',
    prezzoVendita: unita.prezzoVendita || '',
    note: unita.note || '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      await onSave(unita.id, {
        stato: form.stato,
        prezzoListino: parseFloat(form.prezzoListino) || 0,
        acquirente: form.acquirente.trim(),
        prezzoVendita: parseFloat(form.prezzoVendita) || 0,
        note: form.note.trim(),
      })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <ModalShell onClose={onClose}>
      <h3 style={MODAL_TITLE}>✏️ {unita.nome}</h3>

      <Label>Stato</Label>
      <select value={form.stato} onChange={e => set('stato', e.target.value)} style={INPUT}>
        <option value="disponibile">🟢 Disponibile</option>
        <option value="compromesso">🟡 Compromesso</option>
        <option value="rogitato">✅ Rogitato</option>
      </select>

      <Label>Prezzo di listino (€)</Label>
      <input type="number" value={form.prezzoListino} onChange={e => set('prezzoListino', e.target.value)} style={INPUT} placeholder="0" />

      <Label>Acquirente</Label>
      <input value={form.acquirente} onChange={e => set('acquirente', e.target.value)} style={INPUT} placeholder="Nome acquirente..." />

      {(form.stato === 'compromesso' || form.stato === 'rogitato') && (
        <>
          <Label>Prezzo di vendita (€)</Label>
          <input type="number" value={form.prezzoVendita} onChange={e => set('prezzoVendita', e.target.value)} style={INPUT} placeholder="0" />
        </>
      )}

      <Label>Note</Label>
      <input value={form.note} onChange={e => set('note', e.target.value)} style={INPUT} placeholder="Note..." />

      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button onClick={onClose} style={{ ...BTN, background: 'var(--bg-card2)', color: 'var(--text)', flex: 1 }}>Annulla</button>
        <button onClick={save} disabled={saving} style={{ ...BTN, background: 'var(--blue)', color: '#0d1117', flex: 2, opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Salvataggio...' : 'Salva'}
        </button>
      </div>
    </ModalShell>
  )
}

/* ─── SHARED UI ─── */
function ModalShell({ children, onClose }) {
  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'flex-end',
        zIndex: 300,
      }}
    >
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '20px 20px 0 0',
        padding: '24px 20px',
        width: '100%',
        maxWidth: '600px',
        margin: '0 auto',
        border: '1px solid var(--border)',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        {children}
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginTop: '20px' }}>
      <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function KpiCard({ label, val, color, bg }) {
  return (
    <div style={{ background: bg || 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: '800', color }}>{val}</div>
    </div>
  )
}

function RendBadge({ val, big }) {
  const isPos = val >= 0
  return (
    <div style={{
      background: isPos ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)',
      color: isPos ? 'var(--green)' : 'var(--red)',
      border: `1px solid ${isPos ? 'rgba(63,185,80,0.4)' : 'rgba(248,81,73,0.4)'}`,
      padding: big ? '8px 14px' : '4px 10px',
      borderRadius: '20px',
      fontSize: big ? '16px' : '13px',
      fontWeight: '700',
    }}>
      {isPos ? '+' : ''}{val.toFixed(1)}%
    </div>
  )
}

function Chip({ label, active, onClick, color }) {
  return (
    <button onClick={onClick} style={{
      background: active ? (color || 'var(--blue)') + '25' : 'var(--bg-card)',
      color: active ? (color || 'var(--blue)') : 'var(--text-dim)',
      border: `1px solid ${active ? (color || 'var(--blue)') : 'var(--border)'}`,
      borderRadius: '20px',
      padding: '5px 12px',
      fontSize: '12px',
      whiteSpace: 'nowrap',
      fontWeight: active ? '600' : '400',
    }}>
      {label}
    </button>
  )
}

function Label({ children }) {
  return <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '14px', marginBottom: '6px' }}>{children}</div>
}

function Empty({ msg }) {
  return <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)', fontSize: '14px' }}>{msg}</div>
}

function Loader() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: '50px', color: 'var(--text-dim)' }}>Caricamento...</div>
}

const BTN = {
  padding: '11px 18px',
  borderRadius: '10px',
  border: 'none',
  fontSize: '14px',
  fontWeight: '600',
}

const INPUT = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '10px 12px',
  color: 'var(--text)',
  fontSize: '15px',
}

const MODAL_TITLE = {
  fontSize: '18px',
  fontWeight: '700',
  marginBottom: '4px',
}
