import { useState, useEffect } from 'react'
import { db } from '../firebase.js'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, query, where, serverTimestamp, setDoc
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
  { id: 'oneri', label: 'Oneri vari', icon: '📋', colore: 'var(--yellow-bright)' },
  { id: 'massimo', label: 'Massimo', sublabel: 'gestione cantiere', icon: '👷', colore: 'var(--orange)' },
  { id: 'damiano', label: 'Damiano', sublabel: 'tecnico', icon: '📐', colore: 'var(--cyan)' },
  { id: 'alessandro', label: 'Alessandro', sublabel: 'agenzia', icon: '🤝', colore: 'var(--green)' },
]

const STATO_CONFIG = {
  disponibile: { label: 'Disponibile', icon: '🟢', colore: 'var(--green)', bg: 'rgba(63,185,80,0.12)' },
  compromesso: { label: 'Compromesso', icon: '🟡', colore: 'var(--yellow-bright)', bg: 'rgba(211,153,34,0.12)' },
  rogitato: { label: 'Rogitato', icon: '✅', colore: 'var(--blue)', bg: 'rgba(88,166,255,0.12)' },
}

export default function CantiereView({ cantiere, soci, onBack }) {
  const [tab, setTab] = useState('bp')
  const [transazioni, setTransazioni] = useState([])
  const [unita, setUnita] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)

  useEffect(() => {
    setLoading(true)
    setTab('bp')
    const unsubs = []

    const qTx = query(collection(db, 'c_transazioni'), where('cantiereId', '==', cantiere.id))
    unsubs.push(onSnapshot(qTx, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      docs.sort((a, b) => {
        const ta = a.data?.toMillis?.() || 0
        const tb = b.data?.toMillis?.() || 0
        return tb - ta
      })
      setTransazioni(docs)
      setLoading(false)
    }))

    const qU = query(collection(db, 'c_unita'), where('cantiereId', '==', cantiere.id))
    unsubs.push(onSnapshot(qU, snap => {
      setUnita(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) =>
        (a.nome || '').localeCompare(b.nome || '', 'it', { numeric: true })
      ))
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
  const updateUnita = async (id, data) => { await updateDoc(doc(db, 'c_unita', id), data) }
  const addUnita = async (nome) => {
    await addDoc(collection(db, 'c_unita'), { cantiereId: cantiere.id, nome, stato: 'disponibile', prezzoListino: 0 })
  }
  const initUnita = async () => {
    const names = Array.from({ length: cantiere.numUnita }, (_, i) => {
      const n = i + 1
      return `${cantiere.tipoUnita} ${cantiere.numUnita > 9 ? String(n).padStart(2, '0') : n}`
    })
    await Promise.all(names.map(nome =>
      addDoc(collection(db, 'c_unita'), { cantiereId: cantiere.id, nome, stato: 'disponibile', prezzoListino: 0 })
    ))
  }

  const TABS = [
    { id: 'bp', label: 'Business Plan', icon: '🎯' },
    { id: 'unita', label: 'Unità', icon: cantiere.tipoUnita === 'Villetta' ? '🏡' : '🏢' },
    { id: 'entrate', label: 'Entrate', icon: '💚' },
    { id: 'uscite', label: 'Uscite', icon: '💸' },
  ]

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '13px', padding: '0 0 10px 0', cursor: 'pointer' }}>
          ← Tutti i cantieri
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '800', color: cantiere.colore }}>{cantiere.nome}</h2>
              <RendBadge val={rendimento} />
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>{cantiere.descrizione}</div>
          </div>
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
            color: tab === t.id ? '#0d1117' : 'var(--text-dim)',
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
            <span style={{ fontSize: '15px' }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <Loader />}

      {!loading && tab === 'bp' && (
        <BusinessPlanTab cantiere={cantiere} transazioni={transazioni} entrate={entrate} uscite={uscite} guadagno={guadagno} soci={soci} />
      )}
      {!loading && tab === 'unita' && (
        <UnitaTab unita={unita} cantiere={cantiere} updateUnita={updateUnita} addUnita={addUnita} initUnita={initUnita}
          onEdit={(u) => setModal({ tipo: 'unita_edit', data: u })} />
      )}
      {!loading && tab === 'entrate' && (
        <TxTab items={transazioni.filter(t => t.tipo === 'entrata')} color="var(--green)" label="entrate"
          onAdd={() => setModal({ tipo: 'entrata' })} onDelete={deleteTx} />
      )}
      {!loading && tab === 'uscite' && (
        <UsciteTab items={transazioni.filter(t => t.tipo === 'uscita')}
          onAdd={() => setModal({ tipo: 'uscita' })} onDelete={deleteTx} />
      )}

      {modal?.tipo === 'entrata' && <AddTxModal tipo="entrata" onClose={() => setModal(null)} onSave={addTx} />}
      {modal?.tipo === 'uscita' && <AddTxModal tipo="uscita" onClose={() => setModal(null)} onSave={addTx} />}
      {modal?.tipo === 'unita_edit' && <UnitaEditModal unita={modal.data} onClose={() => setModal(null)} onSave={updateUnita} />}
    </div>
  )
}

/* ─── BUSINESS PLAN TAB ─── */
function BusinessPlanTab({ cantiere, transazioni, entrate, uscite, guadagno, soci }) {
  const [piano, setPiano] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'c_business_plan', cantiere.id), snap => {
      setPiano(snap.exists() ? snap.data() : null)
      setLoading(false)
    })
    return () => unsub()
  }, [cantiere.id])

  const startEdit = () => {
    setForm({
      entratePreviste: piano?.entratePreviste || '',
      lavori: piano?.uscitePreviste?.lavori || '',
      terreno: piano?.uscitePreviste?.terreno || '',
      massimo: piano?.uscitePreviste?.massimo || '',
      damiano: piano?.uscitePreviste?.damiano || '',
      alessandro: piano?.uscitePreviste?.alessandro || '',
      note: piano?.note || '',
    })
    setEditing(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      await setDoc(doc(db, 'c_business_plan', cantiere.id), {
        entratePreviste: parseFloat(form.entratePreviste) || 0,
        uscitePreviste: {
          lavori: parseFloat(form.lavori) || 0,
          terreno: parseFloat(form.terreno) || 0,
          massimo: parseFloat(form.massimo) || 0,
          damiano: parseFloat(form.damiano) || 0,
          alessandro: parseFloat(form.alessandro) || 0,
        },
        note: form.note || '',
        updatedAt: serverTimestamp(),
      })
      setEditing(false)
    } finally { setSaving(false) }
  }

  if (loading) return <Loader />

  const entratePrev = piano?.entratePreviste || 0
  const uscitePrevCat = CATEGORIE_USCITE.map(cat => ({
    ...cat,
    previsto: piano?.uscitePreviste?.[cat.id] || 0,
    effettivo: transazioni.filter(t => t.tipo === 'uscita' && t.categoria === cat.id).reduce((s, t) => s + (t.importo || 0), 0),
  }))
  const uscitePrevTot = uscitePrevCat.reduce((s, c) => s + c.previsto, 0)
  const guadagnoPrev = entratePrev - uscitePrevTot
  const rendimentoPrev = uscitePrevTot > 0 ? (guadagnoPrev / uscitePrevTot) * 100 : 0

  if (!piano && !editing) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 20px' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎯</div>
        <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>Business Plan non configurato</div>
        <div style={{ color: 'var(--text-dim)', fontSize: '14px', marginBottom: '24px' }}>
          Inserisci le previsioni di ricavo e i budget per ogni categoria di spesa
        </div>
        <button onClick={startEdit} style={{ ...BTN, background: cantiere.colore, color: '#0d1117' }}>
          Configura Business Plan
        </button>
      </div>
    )
  }

  if (editing) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: '700' }}>🎯 Business Plan</h3>
        </div>

        <SectionLabel>Entrate previste (vendite totali)</SectionLabel>
        <div style={{ background: 'rgba(63,185,80,0.08)', border: '1px solid rgba(63,185,80,0.3)', borderRadius: '10px', padding: '14px', marginBottom: '20px' }}>
          <Label>Totale ricavi previsti (€)</Label>
          <input type="number" value={form.entratePreviste} onChange={e => set('entratePreviste', e.target.value)} style={INPUT} placeholder="0" />
        </div>

        <SectionLabel>Budget uscite per categoria</SectionLabel>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', marginBottom: '20px' }}>
          {CATEGORIE_USCITE.map(cat => (
            <div key={cat.id}>
              <Label>{cat.icon} {cat.label}{cat.sublabel ? ` (${cat.sublabel})` : ''}</Label>
              <input type="number" value={form[cat.id]} onChange={e => set(cat.id, e.target.value)} style={INPUT} placeholder="0" />
            </div>
          ))}
        </div>

        <Label>Note</Label>
        <input value={form.note} onChange={e => set('note', e.target.value)} style={{ ...INPUT, marginBottom: '20px' }} placeholder="Note sul business plan..." />

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setEditing(false)} style={{ ...BTN, background: 'var(--bg-card2)', color: 'var(--text)', flex: 1 }}>Annulla</button>
          <button onClick={save} disabled={saving} style={{ ...BTN, background: cantiere.colore, color: '#0d1117', flex: 2, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Salvataggio...' : 'Salva Business Plan'}
          </button>
        </div>
      </div>
    )
  }

  // View mode — Previsione vs Effettivo
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '17px', fontWeight: '700' }}>🎯 Business Plan</h3>
        <button onClick={startEdit} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 12px', color: 'var(--text-dim)', fontSize: '12px' }}>
          ✏️ Modifica
        </button>
      </div>

      {/* Riepilogo header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
        <CompareCard label="Entrate" prev={entratePrev} eff={entrate} colorPos="var(--green)" colorNeg="var(--red)" />
        <CompareCard label="Uscite totali" prev={uscitePrevTot} eff={uscite} colorPos="var(--green)" colorNeg="var(--red)" invertLogic />
      </div>

      {/* Guadagno previsto vs effettivo */}
      <div style={{
        background: 'var(--bg-card)',
        border: `1px solid ${guadagnoPrev >= 0 ? 'rgba(63,185,80,0.3)' : 'rgba(248,81,73,0.3)'}`,
        borderRadius: '12px', padding: '16px', marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Guadagno</div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'baseline' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Previsto</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: guadagnoPrev >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(guadagnoPrev)}</div>
              </div>
              <div style={{ color: 'var(--text-dim)', fontSize: '16px' }}>→</div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Effettivo</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: guadagno >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(guadagno)}</div>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>Rendimento</div>
            <RendBadge val={rendimentoPrev} label="prev" small />
          </div>
        </div>
      </div>

      {/* Uscite per categoria — previsto vs effettivo */}
      <SectionLabel>Uscite per categoria</SectionLabel>
      {uscitePrevCat.map(cat => {
        const scostamento = cat.effettivo - cat.previsto
        const pctUsato = cat.previsto > 0 ? Math.min(100, (cat.effettivo / cat.previsto) * 100) : 0
        const overBudget = cat.previsto > 0 && cat.effettivo > cat.previsto
        const barColor = overBudget ? 'var(--red)' : 'var(--green)'

        return (
          <div key={cat.id} style={{
            background: 'var(--bg-card)',
            border: `1px solid ${overBudget ? 'rgba(248,81,73,0.3)' : 'var(--border)'}`,
            borderRadius: '10px', padding: '13px 14px', marginBottom: '8px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>{cat.icon}</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: cat.colore }}>{cat.label}</div>
                  {cat.sublabel && <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{cat.sublabel}</div>}
                </div>
              </div>
              {overBudget && (
                <span style={{ fontSize: '11px', color: 'var(--red)', background: 'rgba(248,81,73,0.12)', padding: '2px 8px', borderRadius: '20px', fontWeight: '600' }}>
                  ⚠️ Over budget
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' }}>
              <div style={{ background: 'var(--bg-card2)', borderRadius: '7px', padding: '7px 8px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '2px' }}>Previsto</div>
                <div style={{ fontSize: '13px', fontWeight: '700' }}>{fmt(cat.previsto)}</div>
              </div>
              <div style={{ background: 'var(--bg-card2)', borderRadius: '7px', padding: '7px 8px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '2px' }}>Effettivo</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: cat.effettivo > 0 ? 'var(--red)' : 'var(--text-dim)' }}>{fmt(cat.effettivo)}</div>
              </div>
              <div style={{ background: 'var(--bg-card2)', borderRadius: '7px', padding: '7px 8px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '2px' }}>Scostamento</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: scostamento > 0 ? 'var(--red)' : scostamento < 0 ? 'var(--green)' : 'var(--text-dim)' }}>
                  {scostamento > 0 ? '+' : ''}{fmt(scostamento)}
                </div>
              </div>
            </div>

            {cat.previsto > 0 && (
              <>
                <div style={{ background: 'var(--bg-card2)', borderRadius: '3px', height: '5px', overflow: 'hidden' }}>
                  <div style={{ width: `${pctUsato}%`, height: '100%', background: barColor, borderRadius: '3px', transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '4px' }}>
                  {pctUsato.toFixed(0)}% del budget utilizzato
                </div>
              </>
            )}
          </div>
        )
      })}

      {/* Quote soci su guadagno previsto */}
      <SectionLabel style={{ marginTop: '20px' }}>Quote soci — guadagno previsto</SectionLabel>
      <div style={{ display: 'flex', gap: '8px' }}>
        {soci.map(s => (
          <div key={s.nome} style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderTop: `2px solid ${s.colore}`, borderRadius: '10px', padding: '10px' }}>
            <div style={{ fontSize: '10px', color: s.colore, fontWeight: '600', marginBottom: '2px' }}>{s.nome} {s.pct}%</div>
            <div style={{ fontSize: '14px', fontWeight: '800' }}>{fmt(guadagnoPrev * s.pct / 100)}</div>
          </div>
        ))}
      </div>

      {piano?.note && (
        <div style={{ marginTop: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>Note</div>
          <div style={{ fontSize: '13px', fontStyle: 'italic' }}>{piano.note}</div>
        </div>
      )}
    </div>
  )
}

function CompareCard({ label, prev, eff, colorPos, colorNeg, invertLogic }) {
  const delta = eff - prev
  const isGood = invertLogic ? delta <= 0 : delta >= 0
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Previsto</span>
          <span style={{ fontSize: '13px', fontWeight: '600' }}>{fmt(prev)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Effettivo</span>
          <span style={{ fontSize: '13px', fontWeight: '700' }}>{fmt(eff)}</span>
        </div>
        {prev > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '4px', marginTop: '2px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Δ</span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: isGood ? colorPos : colorNeg }}>
              {delta > 0 ? '+' : ''}{fmt(delta)}
            </span>
          </div>
        )}
      </div>
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
        <div style={{ color: 'var(--text-dim)', marginBottom: '20px', fontSize: '14px' }}>Nessuna unità configurata</div>
        <button onClick={initUnita} style={{ ...BTN, background: cantiere.colore, color: '#0d1117', fontWeight: '700' }}>
          Inizializza {cantiere.numUnita} {cantiere.tipoUnita === 'Villetta' ? 'Villette' : 'Appartamenti'}
        </button>
      </div>
    )
  }

  return (
    <div>
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
        <button onClick={async () => {
          const nome = prompt(`Nome nuova unità:`)
          if (nome?.trim()) await addUnita(nome.trim())
        }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 12px', color: 'var(--text-dim)', fontSize: '12px' }}>
          + Aggiungi
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {unita.map(u => {
          const stato = STATO_CONFIG[u.stato || 'disponibile']
          return (
            <div key={u.id} onClick={() => onEdit(u)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '2px' }}>{u.nome}</div>
                {u.acquirente && <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>👤 {u.acquirente}</div>}
                {u.note && <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontStyle: 'italic' }}>{u.note}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: stato.bg, color: stato.colore, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
                  {stato.icon} {stato.label}
                </div>
                {u.prezzoVendita > 0 && <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--green)' }}>{fmt(u.prezzoVendita)}</div>}
                {!u.prezzoVendita && u.prezzoListino > 0 && <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{fmt(u.prezzoListino)}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── TX TAB ─── */
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
      {items.length === 0 ? <Empty msg={`Nessuna ${label.slice(0, -1)} registrata`} /> :
        items.map(t => <TxRow key={t.id} t={t} color={color} onDelete={onDelete} />)
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
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '14px' }}>
        <Chip label="Tutte" active={filterCat === 'all'} onClick={() => setFilterCat('all')} />
        {CATEGORIE_USCITE.map(c => (
          <Chip key={c.id} label={`${c.icon} ${c.label.split(' ')[0]}`} active={filterCat === c.id} color={c.colore} onClick={() => setFilterCat(c.id)} />
        ))}
      </div>
      {filterCat === 'all' && totale > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
          {CATEGORIE_USCITE.map(cat => {
            const tot = items.filter(t => t.categoria === cat.id).reduce((s, t) => s + (t.importo || 0), 0)
            if (!tot) return null
            return (
              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', minWidth: '20px' }}>{cat.icon}</span>
                <span style={{ fontSize: '11px', color: cat.colore, minWidth: '100px' }}>{cat.label}</span>
                <div style={{ flex: 1, background: 'var(--bg-card2)', borderRadius: '3px', height: '6px' }}>
                  <div style={{ width: `${(tot / totale) * 100}%`, height: '100%', background: cat.colore, borderRadius: '3px' }} />
                </div>
                <span style={{ fontSize: '12px', fontWeight: '600', minWidth: '60px', textAlign: 'right' }}>{fmt(tot)}</span>
              </div>
            )
          })}
        </div>
      )}
      {filtered.length === 0 ? <Empty msg="Nessuna uscita registrata" /> :
        filtered.map(t => {
          const cat = CATEGORIE_USCITE.find(c => c.id === t.categoria)
          return <TxRow key={t.id} t={t} color="var(--red)" onDelete={onDelete} cat={cat} />
        })
      }
    </div>
  )
}

function TxRow({ t, color, onDelete, cat }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '13px 14px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '3px' }}>{t.descrizione}</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {cat && <span style={{ fontSize: '10px', color: cat.colore, background: `${cat.colore}18`, padding: '2px 7px', borderRadius: '20px' }}>{cat.icon} {cat.label}</span>}
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

/* ─── MODALS ─── */
function AddTxModal({ tipo, onClose, onSave }) {
  const [form, setForm] = useState({ descrizione: '', importo: '', categoria: tipo === 'uscita' ? 'lavori' : 'vendita', data: new Date().toISOString().split('T')[0], note: '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.descrizione.trim() || !form.importo) return
    setSaving(true)
    try {
      await onSave({ tipo, descrizione: form.descrizione.trim(), importo: parseFloat(form.importo), categoria: form.categoria, data: new Date(form.data), note: form.note.trim() })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <ModalShell onClose={onClose}>
      <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>{tipo === 'entrata' ? '💚 Nuova Entrata' : '💸 Nuova Uscita'}</h3>
      {tipo === 'uscita' && (
        <><Label>Categoria</Label>
        <select value={form.categoria} onChange={e => set('categoria', e.target.value)} style={INPUT}>
          {CATEGORIE_USCITE.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}{c.sublabel ? ` (${c.sublabel})` : ''}</option>)}
        </select></>
      )}
      <Label>Descrizione *</Label>
      <input value={form.descrizione} onChange={e => set('descrizione', e.target.value)} style={INPUT} placeholder="Es. SAL 1 impresa costruzioni" />
      <Label>Importo (€) *</Label>
      <input type="number" value={form.importo} onChange={e => set('importo', e.target.value)} style={INPUT} placeholder="0" />
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

function UnitaEditModal({ unita, onClose, onSave }) {
  const [form, setForm] = useState({ stato: unita.stato || 'disponibile', prezzoListino: unita.prezzoListino || '', acquirente: unita.acquirente || '', prezzoVendita: unita.prezzoVendita || '', note: unita.note || '' })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      await onSave(unita.id, { stato: form.stato, prezzoListino: parseFloat(form.prezzoListino) || 0, acquirente: form.acquirente.trim(), prezzoVendita: parseFloat(form.prezzoVendita) || 0, note: form.note.trim() })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <ModalShell onClose={onClose}>
      <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '4px' }}>✏️ {unita.nome}</h3>
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
        <><Label>Prezzo di vendita (€)</Label>
        <input type="number" value={form.prezzoVendita} onChange={e => set('prezzoVendita', e.target.value)} style={INPUT} placeholder="0" /></>
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

/* ─── SHARED ─── */
function ModalShell({ children, onClose }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', zIndex: 300 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', padding: '24px 20px', width: '100%', maxWidth: '600px', margin: '0 auto', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  )
}

function RendBadge({ val, small }) {
  const isPos = val >= 0
  return (
    <div style={{ background: isPos ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)', color: isPos ? 'var(--green)' : 'var(--red)', border: `1px solid ${isPos ? 'rgba(63,185,80,0.4)' : 'rgba(248,81,73,0.4)'}`, padding: small ? '3px 8px' : '4px 10px', borderRadius: '20px', fontSize: small ? '12px' : '13px', fontWeight: '700' }}>
      {isPos ? '+' : ''}{val.toFixed(1)}%
    </div>
  )
}

function Chip({ label, active, onClick, color }) {
  return (
    <button onClick={onClick} style={{ background: active ? (color || 'var(--blue)') + '25' : 'var(--bg-card)', color: active ? (color || 'var(--blue)') : 'var(--text-dim)', border: `1px solid ${active ? (color || 'var(--blue)') : 'var(--border)'}`, borderRadius: '20px', padding: '5px 12px', fontSize: '12px', whiteSpace: 'nowrap', fontWeight: active ? '600' : '400' }}>
      {label}
    </button>
  )
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px', marginTop: '20px' }}>{children}</div>
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

const BTN = { padding: '11px 18px', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: '600' }
const INPUT = { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '15px' }
