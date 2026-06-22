import { useState } from 'react'
import Dashboard from './components/Dashboard.jsx'
import CantiereView from './components/CantiereView.jsx'
import ContoCorrenteView from './components/ContoCorrenteView.jsx'

export const CANTIERI = [
  {
    id: 'msr',
    nome: 'MSR',
    descrizione: '3 Villette',
    colore: '#58a6ff',
    numUnita: 3,
    tipoUnita: 'Villetta',
  },
  {
    id: 'msa11',
    nome: 'MSA11',
    descrizione: '16 Appartamenti',
    colore: '#bc8cff',
    numUnita: 16,
    tipoUnita: 'Appartamento',
  },
]

export const SOCI = [
  { nome: 'Chiara', pct: 50, colore: '#bc8cff' },
  { nome: 'Damiano', pct: 25, colore: '#58a6ff' },
  { nome: 'Valentina', pct: 25, colore: '#3fb950' },
]

const NAV = [
  { id: 'dashboard', label: 'Overview', icon: '📊' },
  { id: 'msr', label: 'MSR', icon: '🏡' },
  { id: 'msa11', label: 'MSA11', icon: '🏢' },
  { id: 'cc', label: 'Finanze', icon: '💳' },
]

export default function App() {
  const [view, setView] = useState('dashboard')
  const cantiere = CANTIERI.find(c => c.id === view)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', paddingBottom: '72px' }}>
      {/* Header */}
      <div style={{
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        padding: '14px 20px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <span style={{ fontSize: '20px' }}>🏗️</span>
        <div>
          <div style={{ fontWeight: '700', fontSize: '15px', lineHeight: 1.2 }}>Cantieri SRL</div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            {view === 'dashboard' ? 'Overview generale' : view === 'cc' ? 'Finanze & Debiti' : cantiere?.descrizione}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '18px 14px' }}>
        {view === 'dashboard' && <Dashboard cantieri={CANTIERI} soci={SOCI} />}
        {cantiere && <CantiereView cantiere={cantiere} soci={SOCI} />}
        {view === 'cc' && <ContoCorrenteView cantieri={CANTIERI} />}
      </div>

      {/* Bottom Nav */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {NAV.map(item => {
          const active = view === item.id
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              style={{
                flex: 1,
                padding: '10px 4px 8px',
                background: 'none',
                border: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                color: active ? 'var(--blue)' : 'var(--text-dim)',
                transition: 'color 0.15s',
                position: 'relative',
              }}
            >
              {active && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: '20%',
                  right: '20%',
                  height: '2px',
                  background: 'var(--blue)',
                  borderRadius: '0 0 2px 2px',
                }} />
              )}
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              <span style={{ fontSize: '10px', fontWeight: active ? '700' : '400' }}>{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
