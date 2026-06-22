import { useState, useEffect } from 'react'
import { db } from '../firebase.js'
import { collection, onSnapshot, doc } from 'firebase/firestore'

const fmt = (n) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

export default function Dashboard({ cantieri, soci }) {
  const [transazioni, setTransazioni] = useState([])
  const [debiti, setDebiti] = useState([])
  const [config, setConfig] = useState({ saldoCC: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubs = []
    unsubs.push(onSnapshot(collection(db, 'c_transazioni'), snap => {
      setTransazioni(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }))
    unsubs.push(onSnapshot(collection(db, 'c_debiti'), snap => {
      setDebiti(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }))
    unsubs.push(onSnapshot(doc(db, 'c_config', 'main'), snap => {
      if (snap.exists()) setConfig(snap.data())
    }))
    return () => unsubs.forEach(u => u())
  }, [])

  const getStats = (cantiereId) => {
    const tx = transazioni.filter(t => t.cantiereId === cantiereId)
    const entrate = tx.filter(t => t.tipo === 'entrata').reduce((s, t) => s + (t.importo || 0), 0)
    const uscite = tx.filter(t => t.tipo === 'uscita').reduce((s, t) => s + (t.importo || 0), 0)
    const guadagno = entrate - uscite
    const rendimento = uscite > 0 ? (guadagno / uscite) * 100 : 0
    return { entrate, uscite, guadagno, rendimento }
  }

  const totEntrate = cantieri.reduce((s, c) => s + getStats(c.id).entrate, 0)
  const totUscite = cantieri.reduce((s, c) => s + getStats(c.id).uscite, 0)
  const totGuadagno = totEntrate - totUscite
  const totDebiti = debiti.reduce((s, d) => s + (d.importoResiduo || 0), 0)
  const flussoCassa = (config.saldoCC || 0) + totEntrate - totUscite

  if (loading) return <Loader />

  return (
    <div>
      {/* Flusso di cassa grande */}
      <div style={{
        background: 'linear-gradient(135deg, #161b22 0%, #1c2128 100%)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '22px',
        marginBottom: '14px',
      }}>
        <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          💰 Flusso di Cassa
        </div>
        <div style={{ fontSize: '36px', fontWeight: '800', color: flussoCassa >= 0 ? 'var(--green)' : 'var(--red)', marginBottom: '16px' }}>
          {fmt(flussoCassa)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {[
            { label: 'Saldo CC', val: config.saldoCC || 0, color: 'var(--blue)' },
            { label: 'Debiti', val: -totDebiti, color: 'var(--red)' },
            { label: '↑ Entrate totali', val: totEntrate, color: 'var(--green)' },
            { label: '↓ Uscite totali', val: -totUscite, color: 'var(--orange)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '10px 12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '3px' }}>{s.label}</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: s.color }}>{fmt(Math.abs(s.val))}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cantieri cards */}
      <SectionTitle>Cantieri</SectionTitle>
      {cantieri.map(c => {
        const stats = getStats(c.id)
        return (
          <div key={c.id} style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderLeft: `3px solid ${c.colore}`,
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '10px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '17px', fontWeight: '800', color: c.colore }}>{c.nome}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{c.descrizione}</div>
              </div>
              <RendimentoBadge val={stats.rendimento} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
              <MiniCard label="Entrate" val={fmt(stats.entrate)} color="var(--green)" />
              <MiniCard label="Uscite" val={fmt(stats.uscite)} color="var(--red)" />
              <MiniCard label="Guadagno" val={fmt(stats.guadagno)} color={stats.guadagno >= 0 ? 'var(--green)' : 'var(--red)'} />
            </div>

            {/* Quota soci */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '8px' }}>Quote soci sul guadagno</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {soci.map(s => (
                  <div key={s.nome} style={{
                    flex: 1,
                    background: 'var(--bg-card2)',
                    borderRadius: '8px',
                    padding: '8px',
                    borderTop: `2px solid ${s.colore}`,
                  }}>
                    <div style={{ fontSize: '10px', color: s.colore, fontWeight: '600', marginBottom: '2px' }}>{s.nome} {s.pct}%</div>
                    <div style={{ fontSize: '13px', fontWeight: '700' }}>{fmt(stats.guadagno * s.pct / 100)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })}

      {/* Debiti summary */}
      {debiti.length > 0 && (
        <>
          <SectionTitle>Debiti & Passività</SectionTitle>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}>
            {debiti.map((d, i) => (
              <div key={d.id} style={{
                padding: '14px 16px',
                borderBottom: i < debiti.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>{d.descrizione}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{TIPO_DEBITO_LABEL[d.tipo] || d.tipo}</div>
                </div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--red)' }}>{fmt(d.importoResiduo)}</div>
              </div>
            ))}
            <div style={{
              padding: '12px 16px',
              background: 'rgba(248,81,73,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-dim)' }}>Totale debiti</span>
              <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--red)' }}>{fmt(totDebiti)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const TIPO_DEBITO_LABEL = {
  mutuo: '🏦 Mutuo',
  finanziamento_soci: '👥 Finanziamento soci',
  debito_cantiere: '🏗️ Debito cantiere',
  altro: '📋 Altro',
}

function RendimentoBadge({ val }) {
  const isPos = val >= 0
  return (
    <div style={{
      background: isPos ? 'rgba(63,185,80,0.15)' : 'rgba(248,81,73,0.15)',
      color: isPos ? 'var(--green)' : 'var(--red)',
      border: `1px solid ${isPos ? 'rgba(63,185,80,0.3)' : 'rgba(248,81,73,0.3)'}`,
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '13px',
      fontWeight: '700',
    }}>
      {isPos ? '+' : ''}{val.toFixed(1)}%
    </div>
  )
}

function MiniCard({ label, val, color }) {
  return (
    <div style={{ background: 'var(--bg-card2)', borderRadius: '8px', padding: '8px 10px' }}>
      <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: '700', color }}>{val}</div>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: '11px',
      fontWeight: '600',
      color: 'var(--text-dim)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: '10px',
      marginTop: '20px',
    }}>
      {children}
    </div>
  )
}

function Loader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', color: 'var(--text-dim)' }}>
      Caricamento...
    </div>
  )
}
