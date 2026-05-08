import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import './App.css'

export default function App() {
  const [session, setSession]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [loginError, setLoginError] = useState('')
  const [clienti, setClienti]     = useState([])
  const [search, setSearch]       = useState('')
  const [showAggiungi, setShowAggiungi] = useState(false)
  const [nuovoNome, setNuovoNome] = useState('')

  // navigazione: null | 'schede' | 'dettaglio'
  const [clienteSel, setClienteSel] = useState(null)
  const [schede, setSchede]         = useState([])
  const [schedaSel, setSchedaSel]   = useState(null)
  const [salvato, setSalvato]       = useState(false)
  const [templates, setTemplates]   = useState([])
  const [showEmail, setShowEmail]   = useState(false)
  const [emailDest, setEmailDest]   = useState('')
  const [emailOgg, setEmailOgg]     = useState('')
  const [emailCorpo, setEmailCorpo] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [editEmail, setEditEmail]   = useState(false)
  const [dateRettifiche, setDateRettifiche] = useState([])
  const [dateRitiro, setDateRitiro]         = useState([])
  const [editingDataId, setEditingDataId]   = useState(null)
  const [editingDataVal, setEditingDataVal] = useState('')
  const [nuovaRettificaVal, setNuovaRettificaVal] = useState(null)
  const [nuovoRitiroVal, setNuovoRitiroVal]       = useState(null)
  const [templateSel, setTemplateSel] = useState('')
  const [schedeArchiviate, setSchedeArchiviate] = useState([])
  const [tutteRettifiche, setTutteRettifiche]   = useState([])
  const [showGestisciEmail, setShowGestisciEmail] = useState(false)
  const [tmplEdit, setTmplEdit] = useState(null)
  const [tmplNuovo, setTmplNuovo] = useState(null)
  const [editingClienteId, setEditingClienteId] = useState(null)
  const [editingClienteNome, setEditingClienteNome] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  const doLogin = async () => {
    setLoginError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setLoginError('Email o password errati')
  }

  const doLogout = async () => {
    await supabase.auth.signOut()
    setClienteSel(null); setSchede([]); setSchedaSel(null)
  }

  const fetchClienti = useCallback(async () => {
    const { data } = await supabase.from('clienti').select('*').order('ragione_sociale')
    setClienti(data || [])
  }, [])

  const fetchRiepilogo = useCallback(async () => {
    const [{ data: sa }, { data: tr }] = await Promise.all([
      supabase.from('registri').select('*').eq('archiviato', true),
      supabase.from('date_rettifiche').select('*').eq('nascosto', false).order('data')
    ])
    setSchedeArchiviate(sa || [])
    setTutteRettifiche(tr || [])
  }, [])

  useEffect(() => {
    if (session) {
      fetchClienti()
      fetchRiepilogo()
      supabase.from('email_templates').select('*').order('creato_il').then(({ data }) => setTemplates(data || []))
    }
  }, [session, fetchClienti, fetchRiepilogo])

  // Aggiorna riepilogo ogni volta che si torna alla lista clienti
  useEffect(() => {
    if (!clienteSel && session) fetchRiepilogo()
  }, [clienteSel, session, fetchRiepilogo])

  // Apri cliente → mostra lista schede
  const apriCliente = async (cliente) => {
    setClienteSel(cliente)
    setSchedaSel(null)
    setClienteEmail(cliente.email || '')
    setEditEmail(false)
    const [{ data: dr }, { data: dri }] = await Promise.all([
      supabase.from('date_rettifiche').select('*').eq('cliente_id', cliente.id).order('data'),
      supabase.from('date_ritiro').select('*').eq('cliente_id', cliente.id).order('data')
    ])
    setDateRettifiche(dr || [])
    setDateRitiro(dri || [])
    setNuovaRettificaVal(null)
    setNuovoRitiroVal(null)
    setEditingDataId(null)
    const { data } = await supabase
      .from('registri').select('*')
      .eq('cliente_id', cliente.id)
      .order('creato_il', { ascending: false })
    setSchede(data || [])
  }

  const aggiungiData = async (tabella, val, setter, resetFn, extraFields = {}) => {
    if (!val) return
    const { data, error } = await supabase.from(tabella).insert({ cliente_id: clienteSel.id, data: val, ...extraFields }).select().single()
    if (error) { alert('Errore salvataggio: ' + error.message); return }
    if (data) setter(prev => [...prev, data].sort((a, b) => a.data.localeCompare(b.data)))
    resetFn(null)
  }

  const salvaModData = async (tabella, id, setter) => {
    await supabase.from(tabella).update({ data: editingDataVal }).eq('id', id)
    setter(prev => prev.map(d => d.id === id ? { ...d, data: editingDataVal } : d))
    setEditingDataId(null)
  }

  const eliminaData = async (tabella, id, setter) => {
    if (!window.confirm('Eliminare questa data?')) return
    await supabase.from(tabella).delete().eq('id', id)
    setter(prev => prev.filter(d => d.id !== id))
  }

  const nascondiRettifica = async (id) => {
    await supabase.from('date_rettifiche').update({ nascosto: true }).eq('id', id)
    setDateRettifiche(prev => prev.map(d => d.id === id ? { ...d, nascosto: true } : d))
  }

  const salvaEmailCliente = async () => {
    await supabase.from('clienti').update({ email: clienteEmail }).eq('id', clienteSel.id)
    const aggiornato = { ...clienteSel, email: clienteEmail }
    setClienteSel(aggiornato)
    setClienti(prev => prev.map(c => c.id === clienteSel.id ? aggiornato : c))
    setEditEmail(false)
  }

  const apriModalEmail = (tmpl) => {
    let oggetto = tmpl.oggetto
    if ((tmpl.nome.toLowerCase().includes('aggiornamento') || tmpl.nome.toLowerCase().includes('xfir')) &&
        schedaSel?.aggiornamento_dal && schedaSel?.aggiornamento_al) {
      oggetto += ` - ${fmt(schedaSel.aggiornamento_dal)} → ${fmt(schedaSel.aggiornamento_al)}`
    }
    setEmailDest(clienteSel?.email || '')
    setEmailOgg(oggetto)
    setEmailCorpo(tmpl.corpo)
    setShowEmail(true)
  }

  const inviaEmail = () => {
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailDest)}&su=${encodeURIComponent(emailOgg)}&body=${encodeURIComponent(emailCorpo)}`
    window.open(url, '_blank')
  }

  // Apri singola scheda
  const apriScheda = (scheda) => setSchedaSel({ ...scheda })

  // Nuova scheda
  const nuovaScheda = async () => {
    const { data } = await supabase
      .from('registri').insert({ cliente_id: clienteSel.id }).select().single()
    if (data) {
      setSchede(prev => [data, ...prev])
      setSchedaSel({ ...data })
    }
  }

  const salvaFlag = async (campo, valore) => {
    const aggiornata = { ...schedaSel, [campo]: valore, aggiornato_il: new Date().toISOString() }
    setSchedaSel(aggiornata)
    setSchede(prev => prev.map(s => s.id === aggiornata.id ? aggiornata : s))
    await supabase.from('registri').update({ [campo]: valore, aggiornato_il: new Date().toISOString() }).eq('id', schedaSel.id)
  }

  const cicloFlag = (campo) => {
    const cur = schedaSel[campo]
    const next = cur === null || cur === undefined ? 'verde' : cur === 'verde' ? 'rosso' : null
    salvaFlag(campo, next)
  }

  const flagIcon = (v) => v === 'verde' ? '🟢' : v === 'rosso' ? '🔴' : '⬜'

  const salvaScheda = async () => {
    if (!schedaSel) return
    await supabase.from('registri').update({
      aggiornamento_dal:    schedaSel.aggiornamento_dal || null,
      aggiornamento_al:     schedaSel.aggiornamento_al || null,
      ultimo_xfir:          schedaSel.ultimo_xfir || null,
      data_peso_destino:    schedaSel.data_peso_destino || null,
      data_peso_destino_al: schedaSel.data_peso_destino_al || null,
      flag_peso_destino:    schedaSel.flag_peso_destino || null,
      note:                 schedaSel.note || null,
      problemi:             schedaSel.problemi || null,
      aggiornato_il:        new Date().toISOString()
    }).eq('id', schedaSel.id)
  }

  const eliminaScheda = async () => {
    if (!window.confirm('Eliminare questa scheda?')) return
    await supabase.from('registri').delete().eq('id', schedaSel.id)
    setSchede(prev => prev.filter(s => s.id !== schedaSel.id))
    setSchedaSel(null)
  }

  const archivia = async () => {
    await supabase.from('registri').update({
      aggiornamento_dal:    schedaSel.aggiornamento_dal || null,
      aggiornamento_al:     schedaSel.aggiornamento_al || null,
      ultimo_xfir:          schedaSel.ultimo_xfir || null,
      data_peso_destino:    schedaSel.data_peso_destino || null,
      data_peso_destino_al: schedaSel.data_peso_destino_al || null,
      flag_peso_destino:    schedaSel.flag_peso_destino || null,
      note:                 schedaSel.note || null,
      problemi:             schedaSel.problemi || null,
      aggiornato_il:        new Date().toISOString(),
      archiviato:           true
    }).eq('id', schedaSel.id)
    const archiviata = { ...schedaSel, archiviato: true }
    setSchedaSel(archiviata)
    setSchede(prev => prev.map(s => s.id === archiviata.id ? archiviata : s))
    setSalvato(true)
    setTimeout(() => setSalvato(false), 2500)
  }

  const salvaNuovoTemplate = async () => {
    if (!tmplNuovo?.nome.trim()) return
    const { data } = await supabase.from('email_templates').insert({
      nome: tmplNuovo.nome.trim(), oggetto: tmplNuovo.oggetto.trim(), corpo: tmplNuovo.corpo.trim()
    }).select().single()
    if (data) setTemplates(prev => [...prev, data])
    setTmplNuovo(null)
  }

  const salvaModificaTemplate = async () => {
    await supabase.from('email_templates').update({
      nome: tmplEdit.nome, oggetto: tmplEdit.oggetto, corpo: tmplEdit.corpo
    }).eq('id', tmplEdit.id)
    setTemplates(prev => prev.map(t => t.id === tmplEdit.id ? tmplEdit : t))
    setTmplEdit(null)
  }

  const eliminaTemplate = async (id) => {
    if (!window.confirm('Eliminare questa email preimpostata?')) return
    await supabase.from('email_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  const rinominaCliente = async (id) => {
    if (!editingClienteNome.trim()) return
    const nome = editingClienteNome.trim()
    await supabase.from('clienti').update({ ragione_sociale: nome }).eq('id', id)
    setClienti(prev => prev.map(c => c.id === id ? { ...c, ragione_sociale: nome } : c))
    setEditingClienteId(null)
  }

  const eliminaCliente = async (id) => {
    if (!window.confirm('Eliminare questo cliente e tutte le sue schede?')) return
    await supabase.from('clienti').delete().eq('id', id)
    setClienti(prev => prev.filter(c => c.id !== id))
  }

  const aggiungiCliente = async () => {
    if (!nuovoNome.trim()) return
    const { data } = await supabase.from('clienti').insert({ ragione_sociale: nuovoNome.trim() }).select().single()
    setNuovoNome(''); setShowAggiungi(false)
    await fetchClienti()
    if (data) apriCliente(data)
  }

  const fmt   = d => d ? new Date(d).toLocaleDateString('it-IT') : '—'
  const fmtDt = d => d ? new Date(d).toLocaleString('it-IT') : '—'

  if (loading) return <div className="loading">Caricamento...</div>

  // ── LOGIN ──
  if (!session) return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-icon">📋</div>
        <h1>Gestione Registri</h1>
        <input type="email" placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==='Enter' && doLogin()} />
        <input type="password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==='Enter' && doLogin()} />
        {loginError && <div className="login-error">{loginError}</div>}
        <button className="login-btn" onClick={doLogin}>Accedi</button>
      </div>
    </div>
  )

  const clientiFiltrati = clienti.filter(c =>
    c.ragione_sociale.toLowerCase().includes(search.toLowerCase())
  )

  // ── DETTAGLIO SCHEDA ──
  if (clienteSel && schedaSel) {
    const readonly = false
    return (
      <div className="app">
        <header className="topbar">
          <button className="back-btn" onClick={() => setSchedaSel(null)}>← Schede</button>
          <span className="topbar-title">{clienteSel.ragione_sociale}</span>
          {readonly
            ? <span className="badge-archiviata">Archiviata</span>
            : <span className="badge-attiva">Attiva</span>
          }
          <button className="logout-btn" onClick={doLogout}>Esci</button>
        </header>

        {salvato && <div className="banner-salvato">✅ Scheda archiviata</div>}

        <div className="detail-page">
          <div className="detail-grid">

            <div className="card">
              <div className="card-title">Informazioni</div>
              <div className="field">
                <label>Data ultimo aggiornamento</label>
                <div className="date-range">
                  <span className="date-range-label">Da</span>
                  <input type="date" disabled={readonly} value={schedaSel.aggiornamento_dal || ''}
                    onChange={e => setSchedaSel({...schedaSel, aggiornamento_dal: e.target.value})}
                    onBlur={salvaScheda} />
                  <span className="date-range-label">A</span>
                  <input type="date" disabled={readonly} value={schedaSel.aggiornamento_al || ''}
                    onChange={e => setSchedaSel({...schedaSel, aggiornamento_al: e.target.value})}
                    onBlur={salvaScheda} />
                </div>
              </div>

              <div className="field">
                <label>Ultimo XFIR inserito</label>
                <input type="text" disabled={readonly} value={schedaSel.ultimo_xfir || ''}
                  onChange={e => setSchedaSel({...schedaSel, ultimo_xfir: e.target.value})}
                  onBlur={salvaScheda} placeholder="N° formulario..." />
              </div>
              <div className="field">
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
                  <label style={{margin:0}}>Data peso a destino</label>
                  <span style={{fontSize:18, cursor:'pointer', userSelect:'none'}} onClick={() => cicloFlag('flag_peso_destino')}>
                    {flagIcon(schedaSel.flag_peso_destino)}
                  </span>
                </div>
                <div className="date-range">
                  <span className="date-range-label">Da</span>
                  <input type="date" disabled={readonly} value={schedaSel.data_peso_destino || ''}
                    onChange={e => setSchedaSel({...schedaSel, data_peso_destino: e.target.value})}
                    onBlur={salvaScheda} />
                  <span className="date-range-label">A</span>
                  <input type="date" disabled={readonly} value={schedaSel.data_peso_destino_al || ''}
                    onChange={e => setSchedaSel({...schedaSel, data_peso_destino_al: e.target.value})}
                    onBlur={salvaScheda} />
                </div>
              </div>

              <div className="field">
                <label>Date rettifiche</label>
                {dateRettifiche.filter(d => d.scheda_id === schedaSel.id).map(d => (
                  <div key={d.id} style={{display:'flex', alignItems:'center', gap:6, marginBottom:4}}>
                    {editingDataId === d.id ? (
                      <>
                        <input type="date" value={editingDataVal} onChange={e => setEditingDataVal(e.target.value)}
                          style={{border:'1.5px solid #3b82f6', borderRadius:7, padding:'4px 8px', fontSize:13}} />
                        <button className="btn-ok" style={{padding:'3px 10px',fontSize:13}} onClick={() => salvaModData('date_rettifiche', d.id, setDateRettifiche)}>✓</button>
                        <button className="btn-cancel" style={{padding:'3px 8px',fontSize:13}} onClick={() => setEditingDataId(null)}>✕</button>
                      </>
                    ) : (
                      <>
                        <span style={{fontSize:13, minWidth:80}}>{fmt(d.data)}</span>
                        <button className="edit-email-btn" onClick={() => { setEditingDataId(d.id); setEditingDataVal(d.data) }}>✏</button>
                        <button className="edit-email-btn" style={{color:'#dc2626',borderColor:'#fca5a5'}} onClick={() => eliminaData('date_rettifiche', d.id, setDateRettifiche)}>🗑</button>
                      </>
                    )}
                  </div>
                ))}
                {nuovaRettificaVal !== null ? (
                  <div style={{display:'flex', gap:6, alignItems:'center'}}>
                    <input type="date" value={nuovaRettificaVal} onChange={e => setNuovaRettificaVal(e.target.value)}
                      style={{border:'1.5px solid #3b82f6', borderRadius:7, padding:'4px 8px', fontSize:13}} />
                    <button className="btn-ok" style={{padding:'3px 10px',fontSize:13}} onClick={() => aggiungiData('date_rettifiche', nuovaRettificaVal, setDateRettifiche, setNuovaRettificaVal, { scheda_id: schedaSel.id })}>✓</button>
                    <button className="btn-cancel" style={{padding:'3px 8px',fontSize:13}} onClick={() => setNuovaRettificaVal(null)}>✕</button>
                  </div>
                ) : (
                  <button className="edit-email-btn" style={{marginTop:2}} onClick={() => setNuovaRettificaVal('')}>+ Aggiungi</button>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-title">Stato</div>
              <div className="flag-legenda">
                <span>🟢 Fatto</span>
                <span>🔴 Non fatto</span>
                <span>⬜ Non impostato</span>
              </div>
              {[
                ['registro_rentri',        'Registro RENTRI'],
                ['registro_conservazione', 'Registro conservazione'],
                ['xfir_rentri',            'XFIR RENTRI'],
                ['xfir_conservazione',     'XFIR conservazione'],
                ['registro_cliente',       'Registro cliente'],
                ['xfir_cliente',           'XFIR cliente'],
                ['archiviazione_email',    'Archiviazione email'],
              ].map(([campo, label]) => (
                <div key={campo}
                  className={`flag-row ${schedaSel[campo] === 'verde' ? 'flag-verde' : schedaSel[campo] === 'rosso' ? 'flag-rosso' : ''}`}
                  onClick={() => cicloFlag(campo)}>
                  <span className="flag-check">{flagIcon(schedaSel[campo])}</span>
                  <span className="flag-label">{label}</span>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="card-title">Note</div>
              <textarea rows={5} disabled={readonly} value={schedaSel.note || ''}
                onChange={e => setSchedaSel({...schedaSel, note: e.target.value})}
                onBlur={salvaScheda} placeholder="Note generali..." />
            </div>

            <div className="card card-warning">
              <div className="card-title">⚠ Problemi / Segnalazioni</div>
              <textarea rows={5} disabled={readonly} value={schedaSel.problemi || ''}
                onChange={e => setSchedaSel({...schedaSel, problemi: e.target.value})}
                onBlur={salvaScheda} placeholder="Segnala eventuali problemi..." />
            </div>

          </div>

          <div className="archivia-bar">
            <span className="archivia-info">Scheda creata il {fmtDt(schedaSel.creato_il)}</span>
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              {templates.length > 0 && <>
                <select
                  value={templateSel}
                  onChange={e => setTemplateSel(e.target.value)}
                  style={{border:'1.5px solid #e5e7eb',borderRadius:7,padding:'8px 10px',fontSize:14,outline:'none'}}>
                  <option value="">Seleziona email...</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
                <button className="email-btn" disabled={!templateSel} onClick={() => {
                  const t = templates.find(x => String(x.id) === String(templateSel))
                  if (t) apriModalEmail(t)
                }}>📧 Invia</button>
              </>}
              <button className="elimina-btn" onClick={eliminaScheda}>🗑 Elimina</button>
              {!schedaSel.archiviato && (
                <button className="archivia-btn" onClick={archivia}>📥 Archivia</button>
              )}
            </div>
          </div>
        </div>

        {showEmail && (
          <div className="backdrop" onClick={e => e.target === e.currentTarget && setShowEmail(false)}>
            <div className="modal" style={{maxWidth:560}}>
              <div className="modal-title">📧 Invia email</div>
              <div className="field">
                <label>A (destinatari)</label>
                <input value={emailDest} onChange={e => setEmailDest(e.target.value)}
                  placeholder="email1@esempio.it, email2@esempio.it" />
              </div>
              <div className="field">
                <label>Oggetto</label>
                <input value={emailOgg} onChange={e => setEmailOgg(e.target.value)} />
              </div>
              <div className="field">
                <label>Testo</label>
                <textarea rows={10} value={emailCorpo} onChange={e => setEmailCorpo(e.target.value)} />
              </div>
              <div className="modal-btns">
                <button className="btn-cancel" onClick={() => setShowEmail(false)}>Annulla</button>
                <button className="btn-ok" onClick={inviaEmail}>📧 Apri nel programma di posta</button>
              </div>
            </div>
          </div>
        )}
      </div>
  )
  }

  // ── LISTA SCHEDE CLIENTE ──
  if (clienteSel) return (
    <div className="app">
      <header className="topbar">
        <button className="back-btn" onClick={() => { setClienteSel(null); setSchede([]) }}>← Clienti</button>
        <span className="topbar-title">{clienteSel.ragione_sociale}</span>
        <button className="logout-btn" onClick={doLogout}>Esci</button>
      </header>

      <div className="list-page" style={{maxWidth:1100}}>
        <div className="email-cliente-bar">
          <span className="email-cliente-label">📧 Email cliente:</span>
          {editEmail
            ? <>
                <input className="email-cliente-input" value={clienteEmail}
                  onChange={e => setClienteEmail(e.target.value)}
                  placeholder="email1@esempio.it, email2@esempio.it"
                  onKeyDown={e => e.key === 'Enter' && salvaEmailCliente()} />
                <button className="btn-ok" style={{padding:'5px 12px',fontSize:13}} onClick={salvaEmailCliente}>Salva</button>
                <button className="btn-cancel" style={{padding:'5px 10px',fontSize:13}} onClick={() => setEditEmail(false)}>✕</button>
              </>
            : <>
                <span className="email-cliente-val">{clienteEmail || <em style={{color:'#9ca3af'}}>non impostata</em>}</span>
                <button className="edit-email-btn" onClick={() => setEditEmail(true)}>✏</button>
              </>
          }
        </div>

        <div className="email-cliente-bar" style={{flexWrap:'wrap', gap:8, alignItems:'center'}}>
          <span className="email-cliente-label" style={{whiteSpace:'nowrap'}}>Date rettifiche:</span>
          {dateRettifiche.filter(d => !d.nascosto).length === 0
            ? <span style={{fontSize:13, color:'#9ca3af'}}>Nessuna — aggiungi dalle singole schede</span>
            : dateRettifiche.filter(d => !d.nascosto).map(d => (
                <div key={d.id} style={{display:'flex', alignItems:'center', gap:4, background:'#f3f4f6', borderRadius:6, padding:'3px 8px'}}>
                  <span style={{fontSize:13}}>{fmt(d.data)}</span>
                  <button className="edit-email-btn" style={{color:'#dc2626', borderColor:'transparent', padding:'0 4px'}} onClick={() => nascondiRettifica(d.id)}>🗑</button>
                </div>
              ))
          }
        </div>

        <div className="email-cliente-bar" style={{flexWrap:'wrap', gap:8, alignItems:'center'}}>
          <span className="email-cliente-label" style={{whiteSpace:'nowrap'}}>Date ritiro previsto:</span>
          {dateRitiro.map(d => (
            editingDataId === d.id ? (
              <div key={d.id} style={{display:'flex', alignItems:'center', gap:6}}>
                <input type="date" value={editingDataVal} onChange={e => setEditingDataVal(e.target.value)}
                  style={{border:'1.5px solid #3b82f6', borderRadius:7, padding:'4px 8px', fontSize:13}} />
                <button className="btn-ok" style={{padding:'3px 10px',fontSize:13}} onClick={() => salvaModData('date_ritiro', d.id, setDateRitiro)}>✓</button>
                <button className="btn-cancel" style={{padding:'3px 8px',fontSize:13}} onClick={() => setEditingDataId(null)}>✕</button>
              </div>
            ) : (
              <div key={d.id} style={{display:'flex', alignItems:'center', gap:4, background:'#f3f4f6', borderRadius:6, padding:'3px 8px'}}>
                <span style={{fontSize:13}}>{fmt(d.data)}</span>
                <button className="edit-email-btn" style={{borderColor:'transparent', padding:'0 4px'}} onClick={() => { setEditingDataId(d.id); setEditingDataVal(d.data) }}>✏</button>
                <button className="edit-email-btn" style={{color:'#dc2626', borderColor:'transparent', padding:'0 4px'}} onClick={() => eliminaData('date_ritiro', d.id, setDateRitiro)}>🗑</button>
              </div>
            )
          ))}
          {nuovoRitiroVal !== null ? (
            <div style={{display:'flex', alignItems:'center', gap:6}}>
              <input type="date" value={nuovoRitiroVal} onChange={e => setNuovoRitiroVal(e.target.value)}
                style={{border:'1.5px solid #3b82f6', borderRadius:7, padding:'4px 8px', fontSize:13}} />
              <button className="btn-ok" style={{padding:'3px 10px',fontSize:13}} onClick={() => aggiungiData('date_ritiro', nuovoRitiroVal, setDateRitiro, setNuovoRitiroVal)}>✓</button>
              <button className="btn-cancel" style={{padding:'3px 8px',fontSize:13}} onClick={() => setNuovoRitiroVal(null)}>✕</button>
            </div>
          ) : (
            <button className="edit-email-btn" onClick={() => setNuovoRitiroVal('')}>+ Aggiungi</button>
          )}
        </div>

        <div className="list-toolbar">
          <span style={{fontSize:14, color:'#6b7280', flex:1}}>
            {schede.length} scheda{schede.length !== 1 ? 'e' : ''} trovata{schede.length !== 1 ? 'e' : ''}
          </span>
          <button className="add-btn" onClick={nuovaScheda}>+ Nuova scheda</button>
        </div>

        <div className="clienti-list">
          {schede.length === 0
            ? <div className="empty">Nessuna scheda — clicca "+ Nuova scheda" per iniziare</div>
            : schede.map(s => {
                const flagiRossi = [
                  ['registro_rentri','Reg. RENTRI'],
                  ['registro_conservazione','Reg. cons.'],
                  ['xfir_rentri','XFIR RENTRI'],
                  ['xfir_conservazione','XFIR cons.'],
                  ['registro_cliente','Reg. cliente'],
                  ['xfir_cliente','XFIR cliente'],
                  ['archiviazione_email','Arch. email'],
                ].filter(([campo]) => s[campo] === 'rosso')
                return (
                  <div key={s.id} className="cliente-row" onClick={() => apriScheda(s)}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap'}}>
                        {s.archiviato
                          ? <span className="badge-archiviata">Archiviata</span>
                          : <span className="badge-attiva">Attiva</span>
                        }
                        {s.aggiornamento_dal && (
                          <span style={{fontSize:13, fontWeight:500}}>
                            Agg.: {fmt(s.aggiornamento_dal)} → {fmt(s.aggiornamento_al)}
                          </span>
                        )}
                        {s.ultimo_xfir && (
                          <span style={{fontSize:13, color:'#6b7280'}}>· XFIR: {s.ultimo_xfir}</span>
                        )}
                        {s.data_peso_destino && (
                          <span style={{fontSize:13, color:'#6b7280'}}>
                            · Peso: {fmt(s.data_peso_destino)}{s.data_peso_destino_al ? ` → ${fmt(s.data_peso_destino_al)}` : ''}
                          </span>
                        )}
                      </div>
                      <div style={{display:'flex', alignItems:'center', gap:6, flexWrap:'wrap'}}>
                        <span style={{fontSize:12, color:'#9ca3af'}}>{fmtDt(s.aggiornato_il || s.creato_il)}</span>
                        {flagiRossi.map(([campo, label]) => (
                          <span key={campo} style={{fontSize:11, background:'#fff1f2', color:'#dc2626', borderRadius:4, padding:'1px 6px'}}>
                            🔴 {label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="cliente-arrow">›</span>
                  </div>
                )
              })
          }
        </div>
      </div>
    </div>
  )

  // ── LISTA CLIENTI ──
  return (
    <div className="app">
      <header className="topbar">
        <span className="topbar-title">📋 Gestione Registri</span>
        <button className="storico-btn" onClick={() => setShowGestisciEmail(true)}>✉ Email</button>
        <button className="logout-btn" onClick={doLogout}>Esci</button>
      </header>

      <div className="list-page" style={{maxWidth:1100}}>
        <div className="list-toolbar">
          <input className="search-input" placeholder="🔍 Cerca cliente..." value={search}
            onChange={e => setSearch(e.target.value)} />
          <button className="add-btn" onClick={() => setShowAggiungi(true)}>+ Aggiungi</button>
        </div>
        <div className="clienti-list">
          {clientiFiltrati.length === 0
            ? <div className="empty">Nessun cliente trovato</div>
            : clientiFiltrati.map(c => {
                const FLAG_CAMPI = ['registro_rentri','registro_conservazione','xfir_rentri','xfir_conservazione','registro_cliente','xfir_cliente','archiviazione_email']
                const FLAG_NAMES = { registro_rentri:'Reg. RENTRI', registro_conservazione:'Reg. cons.', xfir_rentri:'XFIR RENTRI', xfir_conservazione:'XFIR cons.', registro_cliente:'Reg. cliente', xfir_cliente:'XFIR cliente', archiviazione_email:'Arch. email' }

                const schedeC = schedeArchiviate.filter(s => s.cliente_id === c.id)
                const ultimaScheda = [...schedeC].sort((a, b) => new Date(b.aggiornato_il || b.creato_il) - new Date(a.aggiornato_il || a.creato_il))[0]

                const rettificheC = tutteRettifiche.filter(r => r.cliente_id === c.id)
                const primaRettifica = rettificheC[0]

                const pesoRossoC = schedeC.filter(s => s.flag_peso_destino === 'rosso' && s.data_peso_destino)
                  .sort((a, b) => (a.data_peso_destino || '').localeCompare(b.data_peso_destino || ''))
                const pesoMin = pesoRossoC[0]
                const pesoMax = pesoRossoC[pesoRossoC.length - 1]

                const flagRossiSet = new Set()
                schedeC.forEach(s => FLAG_CAMPI.forEach(f => { if (s[f] === 'rosso') flagRossiSet.add(f) }))
                const flagRossi = [...flagRossiSet]

                return (
                  <div key={c.id} className="cliente-row" onClick={() => editingClienteId !== c.id && apriCliente(c)}>
                    <div style={{flex:1}}>
                      {editingClienteId === c.id ? (
                        <div style={{display:'flex', gap:8, alignItems:'center'}} onClick={e => e.stopPropagation()}>
                          <input autoFocus value={editingClienteNome}
                            onChange={e => setEditingClienteNome(e.target.value)}
                            onKeyDown={e => { if (e.key==='Enter') rinominaCliente(c.id); if (e.key==='Escape') setEditingClienteId(null) }}
                            style={{fontSize:15, fontWeight:600, border:'1.5px solid #3b82f6', borderRadius:7, padding:'5px 10px', flex:1}} />
                          <button className="btn-ok" style={{padding:'4px 12px',fontSize:13}} onClick={() => rinominaCliente(c.id)}>✓</button>
                          <button className="btn-cancel" style={{padding:'4px 10px',fontSize:13}} onClick={() => setEditingClienteId(null)}>✕</button>
                        </div>
                      ) : (
                        <>
                          <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:4, flexWrap:'wrap'}}>
                            <span className="cliente-nome" style={{flex:'none'}}>{c.ragione_sociale}</span>
                            {ultimaScheda?.aggiornamento_dal && (
                              <span style={{fontSize:12, color:'#6b7280'}}>
                                Agg.: {fmt(ultimaScheda.aggiornamento_dal)} → {fmt(ultimaScheda.aggiornamento_al)}
                              </span>
                            )}
                            {primaRettifica && (
                              <span style={{fontSize:12, color:'#6b7280'}}>· Rett.: {fmt(primaRettifica.data)}</span>
                            )}
                            {pesoMin && (
                              <span style={{fontSize:12, color:'#6b7280'}}>
                                · Peso: {fmt(pesoMin.data_peso_destino)}{pesoMax?.data_peso_destino_al ? ` → ${fmt(pesoMax.data_peso_destino_al)}` : ''}
                              </span>
                            )}
                          </div>
                          {flagRossi.length > 0 && (
                            <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
                              {flagRossi.map(f => (
                                <span key={f} style={{fontSize:11, background:'#fff1f2', color:'#dc2626', borderRadius:4, padding:'1px 6px'}}>
                                  🔴 {FLAG_NAMES[f]}
                                </span>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div style={{display:'flex', gap:4, alignItems:'center'}} onClick={e => e.stopPropagation()}>
                      {editingClienteId !== c.id && <>
                        <button className="edit-email-btn" onClick={() => { setEditingClienteId(c.id); setEditingClienteNome(c.ragione_sociale) }}>✏</button>
                        <button className="edit-email-btn" style={{color:'#dc2626', borderColor:'#fca5a5'}} onClick={() => eliminaCliente(c.id)}>🗑</button>
                        <span className="cliente-arrow">›</span>
                      </>}
                    </div>
                  </div>
                )
              })
          }
        </div>
      </div>

      {showAggiungi && (
        <div className="backdrop" onClick={e => e.target === e.currentTarget && setShowAggiungi(false)}>
          <div className="modal">
            <div className="modal-title">Nuovo cliente</div>
            <input autoFocus placeholder="Ragione sociale" value={nuovoNome}
              onChange={e => setNuovoNome(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && aggiungiCliente()} />
            <div className="modal-btns">
              <button className="btn-cancel" onClick={() => setShowAggiungi(false)}>Annulla</button>
              <button className="btn-ok" onClick={aggiungiCliente}>Aggiungi</button>
            </div>
          </div>
        </div>
      )}

      {showGestisciEmail && (
        <div className="backdrop" onClick={e => e.target === e.currentTarget && setShowGestisciEmail(false)}>
          <div className="modal" style={{maxWidth:600, maxHeight:'85vh', overflowY:'auto'}}>
            <div className="modal-title">✉ Email preimpostate</div>

            {templates.length === 0 && <p className="text-muted">Nessun template. Aggiungine uno.</p>}

            {templates.map(t => (
              <div key={t.id} style={{border:'1px solid #e5e7eb', borderRadius:8, padding:'12px 14px', marginBottom:8}}>
                {tmplEdit?.id === t.id ? (
                  <div style={{display:'flex', flexDirection:'column', gap:8}}>
                    <input value={tmplEdit.nome} onChange={e => setTmplEdit({...tmplEdit, nome:e.target.value})} placeholder="Nome" />
                    <input value={tmplEdit.oggetto} onChange={e => setTmplEdit({...tmplEdit, oggetto:e.target.value})} placeholder="Oggetto" />
                    <textarea rows={5} value={tmplEdit.corpo} onChange={e => setTmplEdit({...tmplEdit, corpo:e.target.value})} placeholder="Testo email" style={{resize:'vertical', border:'1.5px solid #e0e0e0', borderRadius:8, padding:'8px 10px', fontFamily:'inherit', fontSize:14}} />
                    <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
                      <button className="btn-cancel" onClick={() => setTmplEdit(null)}>Annulla</button>
                      <button className="btn-ok" onClick={salvaModificaTemplate}>Salva</button>
                    </div>
                  </div>
                ) : (
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <span style={{flex:1, fontWeight:600, fontSize:14}}>{t.nome}</span>
                    <button className="edit-email-btn" onClick={() => setTmplEdit({...t})}>✏</button>
                    <button className="edit-email-btn" style={{color:'#dc2626', borderColor:'#fca5a5'}} onClick={() => eliminaTemplate(t.id)}>🗑</button>
                  </div>
                )}
              </div>
            ))}

            {tmplNuovo ? (
              <div style={{border:'1.5px solid #3b82f6', borderRadius:8, padding:'12px 14px', marginBottom:8, display:'flex', flexDirection:'column', gap:8}}>
                <input value={tmplNuovo.nome} onChange={e => setTmplNuovo({...tmplNuovo, nome:e.target.value})} placeholder="Nome (es. Aggiornamento Registro)" />
                <input value={tmplNuovo.oggetto} onChange={e => setTmplNuovo({...tmplNuovo, oggetto:e.target.value})} placeholder="Oggetto email" />
                <textarea rows={5} value={tmplNuovo.corpo} onChange={e => setTmplNuovo({...tmplNuovo, corpo:e.target.value})} placeholder="Testo email" style={{resize:'vertical', border:'1.5px solid #e0e0e0', borderRadius:8, padding:'8px 10px', fontFamily:'inherit', fontSize:14}} />
                <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
                  <button className="btn-cancel" onClick={() => setTmplNuovo(null)}>Annulla</button>
                  <button className="btn-ok" onClick={salvaNuovoTemplate}>Aggiungi</button>
                </div>
              </div>
            ) : (
              <button className="add-btn" style={{width:'100%', marginBottom:8}} onClick={() => setTmplNuovo({nome:'',oggetto:'',corpo:''})}>+ Nuova email</button>
            )}

            <div className="modal-btns">
              <button className="btn-ok" onClick={() => setShowGestisciEmail(false)}>Chiudi</button>
            </div>
          </div>
        </div>
      )}

      {showEmail && (
        <div className="backdrop" onClick={e => e.target === e.currentTarget && setShowEmail(false)}>
          <div className="modal" style={{maxWidth:560}}>
            <div className="modal-title">📧 Invia email</div>
            <div className="field">
              <label>A (destinatari)</label>
              <input value={emailDest} onChange={e => setEmailDest(e.target.value)}
                placeholder="email1@esempio.it, email2@esempio.it" />
            </div>
            <div className="field">
              <label>Oggetto</label>
              <input value={emailOgg} onChange={e => setEmailOgg(e.target.value)} />
            </div>
            <div className="field">
              <label>Testo</label>
              <textarea rows={10} value={emailCorpo} onChange={e => setEmailCorpo(e.target.value)} />
            </div>
            <div className="modal-btns">
              <button className="btn-cancel" onClick={() => setShowEmail(false)}>Annulla</button>
              <button className="btn-ok" onClick={inviaEmail}>📧 Apri nel programma di posta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
