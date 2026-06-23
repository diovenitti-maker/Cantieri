import { useState, useEffect } from 'react'
import { db } from './firebase.js'
import { collection, onSnapshot, addDoc, deleteDoc, doc, writeBatch, getDocs, query, where, setDoc } from 'firebase/firestore'
import Dashboard from './components/Dashboard.jsx'
import CantiereView from './components/CantiereView.jsx'
import ContoCorrenteView from './components/ContoCorrenteView.jsx'

const LOGO_B64 = "data:image/jpeg;base64,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"

export const SOCI = [
  { nome: 'Chiara', pct: 50, colore: '#bc8cff' },
  { nome: 'Damiano', pct: 25, colore: '#58a6ff' },
  { nome: 'Valentina', pct: 25, colore: '#3fb950' },
]

const COLORI_DISPONIBILI = [
  '#58a6ff', '#bc8cff', '#3fb950', '#f85149',
  '#e3b341', '#39c5cf', '#db6d28', '#ff7b72',
]

const CANTIERI_DEFAULT = [
  { nome: 'MSR', descrizione: '3 Villette', numUnita: 3, tipoUnita: 'Villetta', colore: '#58a6ff', order: 0 },
  { nome: 'MSA11', descrizione: '16 Appartamenti', numUnita: 16, tipoUnita: 'Appartamento', colore: '#bc8cff', order: 1 },
]

export default function App() {
  const [view, setView] = useState('dashboard') // 'dashboard' | 'cantieri' | 'cantiere_{id}' | 'cc'
  const [cantieri, setCantieri] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'c_cantieri'), async snap => {
      if (snap.empty && !seeding) {
        setSeeding(true)
        // Seed cantieri di default
        for (const c of CANTIERI_DEFAULT) {
          await addDoc(collection(db, 'c_cantieri'), c)
        }
        setSeeding(false)
      } else {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        docs.sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
        setCantieri(docs)
        setLoading(false)
      }
    })
    return () => unsub()
  }, [])

  const addCantiere = async (data) => {
    await addDoc(collection(db, 'c_cantieri'), { ...data, order: cantieri.length })
  }

  const deleteCantiere = async (cantiere) => {
    if (!confirm(`Eliminare il cantiere "${cantiere.nome}" e tutti i suoi dati?\n\nQuesta azione è irreversibile.`)) return
    const batch = writeBatch(db)
    // Delete cantiere doc
    batch.delete(doc(db, 'c_cantieri', cantiere.id))
    // Delete business plan
    batch.delete(doc(db, 'c_business_plan', cantiere.id))
    await batch.commit()
    // Delete transactions, units (can't batch query results, do separately)
    const txSnap = await getDocs(query(collection(db, 'c_transazioni'), where('cantiereId', '==', cantiere.id)))
    const unitaSnap = await getDocs(query(collection(db, 'c_unita'), where('cantiereId', '==', cantiere.id)))
    const batch2 = writeBatch(db)
    txSnap.docs.forEach(d => batch2.delete(d.ref))
    unitaSnap.docs.forEach(d => batch2.delete(d.ref))
    await batch2.commit()
    // If we were viewing this cantiere, go back
    if (view === `cantiere_${cantiere.id}`) setView('cantieri')
  }

  const cantiereAttivo = cantieri.find(c => view === `cantiere_${c.id}`)

  const NAV = [
    { id: 'dashboard', label: 'Overview', icon: '📊' },
    { id: 'cantieri', label: 'Cantieri', icon: '🏗️' },
    { id: 'cc', label: 'Finanze', icon: '💳' },
  ]

  const viewLabel = () => {
    if (view === 'dashboard') return 'Overview generale'
    if (view === 'cantieri') return 'Gestione cantieri'
    if (view === 'cc') return 'Finanze & Debiti'
    if (cantiereAttivo) return cantiereAttivo.descrizione
    return ''
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: '72px' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '10px 16px', position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ background: '#fff', borderRadius: '8px', padding: '4px 6px', flexShrink: 0 }}>
          <img src={LOGO_B64} alt="Logo" style={{ height: '36px', width: 'auto', display: 'block' }} />
        </div>
        <div>
          <div style={{ fontWeight: '800', fontSize: '13px', lineHeight: 1.2, color: 'var(--text)' }}>
            IOVENITTI & C. COSTRUZIONI S.r.l.
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>{viewLabel()}</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '18px 14px' }}>
        {loading && <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-dim)' }}>Caricamento...</div>}
        {!loading && view === 'dashboard' && <Dashboard cantieri={cantieri} soci={SOCI} />}
        {!loading && view === 'cantieri' && (
          <CantierList
            cantieri={cantieri}
            onOpen={(c) => setView(`cantiere_${c.id}`)}
            onDelete={deleteCantiere}
            onAdd={() => setShowAddModal(true)}
          />
        )}
        {!loading && cantiereAttivo && (
          <CantiereView cantiere={cantiereAttivo} soci={SOCI} onBack={() => setView('cantieri')} />
        )}
        {!loading && view === 'cc' && <ContoCorrenteView cantieri={cantieri} soci={SOCI} />}
      </div>

      {/* Bottom Nav */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--bg-card)', borderTop: '1px solid var(--border)', display: 'flex', zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {NAV.map(item => {
          const active = item.id === 'cantieri'
            ? (view === 'cantieri' || !!cantiereAttivo)
            : view === item.id
          return (
            <button key={item.id} onClick={() => setView(item.id)} style={{
              flex: 1, padding: '10px 4px 8px', background: 'none', border: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
              color: active ? 'var(--blue)' : 'var(--text-dim)', position: 'relative',
            }}>
              {active && <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: '2px', background: 'var(--blue)', borderRadius: '0 0 2px 2px' }} />}
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              <span style={{ fontSize: '10px', fontWeight: active ? '700' : '400' }}>{item.label}</span>
            </button>
          )
        })}
      </div>

      {showAddModal && (
        <AddCantiereModal
          coloriUsati={cantieri.map(c => c.colore)}
          coloriDisponibili={COLORI_DISPONIBILI}
          onClose={() => setShowAddModal(false)}
          onSave={addCantiere}
        />
      )}
    </div>
  )
}

/* ─── LISTA CANTIERI ─── */
function CantierList({ cantieri, onOpen, onDelete, onAdd }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '800' }}>🏗️ Cantieri</h2>
        <button onClick={onAdd} style={{ background: 'var(--blue)', border: 'none', borderRadius: '10px', padding: '10px 16px', color: '#0d1117', fontSize: '14px', fontWeight: '700' }}>
          + Nuovo cantiere
        </button>
      </div>

      {cantieri.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏗️</div>
          <div>Nessun cantiere. Aggiungine uno!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {cantieri.map(c => (
            <div key={c.id} style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderLeft: `4px solid ${c.colore}`,
              borderRadius: '12px',
              padding: '18px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: c.colore }}>{c.nome}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>{c.descrizione} · {c.numUnita} {c.tipoUnita === 'Villetta' ? 'villette' : c.tipoUnita === 'Appartamento' ? 'appartamenti' : c.tipoUnita?.toLowerCase() + 'i'}</div>
                </div>
                <button
                  onClick={() => onDelete(c)}
                  style={{ background: 'rgba(248,81,73,0.12)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: '8px', padding: '6px 10px', color: 'var(--red)', fontSize: '13px' }}
                >
                  🗑️ Elimina
                </button>
              </div>
              <button
                onClick={() => onOpen(c)}
                style={{ width: '100%', background: c.colore, border: 'none', borderRadius: '10px', padding: '12px', color: '#0d1117', fontSize: '14px', fontWeight: '700' }}
              >
                Apri cantiere →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── MODAL NUOVO CANTIERE ─── */
function AddCantiereModal({ onClose, onSave, coloriDisponibili, coloriUsati }) {
  const [form, setForm] = useState({
    nome: '',
    tipoUnita: 'Appartamento',
    numUnita: '',
    colore: coloriDisponibili.find(c => !coloriUsati.includes(c)) || coloriDisponibili[0],
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const descrizione = form.numUnita && form.tipoUnita
    ? `${form.numUnita} ${form.tipoUnita === 'Villetta' ? 'Villette' : form.tipoUnita === 'Appartamento' ? 'Appartamenti' : form.tipoUnita + 'i'}`
    : ''

  const save = async () => {
    if (!form.nome.trim() || !form.numUnita) return
    setSaving(true)
    try {
      await onSave({
        nome: form.nome.trim().toUpperCase(),
        descrizione,
        numUnita: parseInt(form.numUnita),
        tipoUnita: form.tipoUnita,
        colore: form.colore,
      })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', zIndex: 300 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', padding: '24px 20px', width: '100%', maxWidth: '600px', margin: '0 auto', border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px' }}>🏗️ Nuovo Cantiere</h3>

        <Label>Nome cantiere *</Label>
        <input value={form.nome} onChange={e => set('nome', e.target.value)} style={INPUT} placeholder="Es. VIA ROMA 12" />

        <Label>Tipo unità</Label>
        <select value={form.tipoUnita} onChange={e => set('tipoUnita', e.target.value)} style={INPUT}>
          <option value="Appartamento">🏢 Appartamento</option>
          <option value="Villetta">🏡 Villetta</option>
          <option value="Villa">🏘️ Villa</option>
          <option value="Ufficio">🏬 Ufficio</option>
          <option value="Locale">🏪 Locale commerciale</option>
        </select>

        <Label>Numero unità *</Label>
        <input type="number" value={form.numUnita} onChange={e => set('numUnita', e.target.value)} style={INPUT} placeholder="Es. 8" min="1" />

        <Label>Colore identificativo</Label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
          {coloriDisponibili.map(col => (
            <button key={col} onClick={() => set('colore', col)} style={{
              width: '36px', height: '36px', borderRadius: '50%', background: col, border: form.colore === col ? '3px solid #fff' : '3px solid transparent',
              outline: form.colore === col ? `2px solid ${col}` : 'none', cursor: 'pointer',
            }} />
          ))}
        </div>

        {descrizione && (
          <div style={{ marginTop: '16px', background: 'var(--bg-card2)', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '2px' }}>Anteprima</div>
            <div style={{ fontWeight: '700', color: form.colore }}>{form.nome.toUpperCase() || '—'}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>{descrizione}</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button onClick={onClose} style={{ ...BTN, background: 'var(--bg-card2)', color: 'var(--text)', flex: 1 }}>Annulla</button>
          <button onClick={save} disabled={saving || !form.nome || !form.numUnita} style={{ ...BTN, background: 'var(--blue)', color: '#0d1117', flex: 2, opacity: (saving || !form.nome || !form.numUnita) ? 0.5 : 1 }}>
            {saving ? 'Creazione...' : 'Crea cantiere'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Label({ children }) {
  return <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '14px', marginBottom: '6px' }}>{children}</div>
}

const BTN = { padding: '11px 18px', borderRadius: '10px', border: 'none', fontSize: '14px', fontWeight: '600' }
const INPUT = { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '15px' }
