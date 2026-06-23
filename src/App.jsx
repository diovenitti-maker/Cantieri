import { useState, useEffect } from 'react'
import { db } from './firebase.js'
import { collection, onSnapshot, addDoc, deleteDoc, doc, writeBatch, getDocs, query, where, setDoc } from 'firebase/firestore'
import Dashboard from './components/Dashboard.jsx'
import CantiereView from './components/CantiereView.jsx'
import ContoCorrenteView from './components/ContoCorrenteView.jsx'

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
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontWeight: '800', fontSize: '14px', lineHeight: 1.2, color: 'var(--text)' }}>
          🏗️ IOVENITTI & C. COSTRUZIONI S.r.l.
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>{viewLabel()}</div>
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
