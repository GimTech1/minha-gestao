import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setOk('')
    setBusy(true)
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() }, emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
        })
        if (error) throw error
        if (!data.session) setOk('Conta criada! Confirme pelo link que enviamos para o seu e-mail e depois entre aqui.')
      }
    } catch (e) {
      const msg = (e as Error).message
      setErr(
        msg.includes('Invalid login') ? 'E-mail ou senha incorretos' :
        msg.includes('Email not confirmed') ? 'Confirme seu e-mail antes de entrar' :
        msg.includes('already registered') ? 'Esse e-mail já tem conta. Entre com sua senha.' :
        msg.includes('Password should') ? 'A senha precisa ter pelo menos 6 caracteres' : msg,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="login" onSubmit={submit}>
      <img className="logo" src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" />
      <h1>{mode === 'in' ? 'Bem-vindo de volta' : 'Criar sua conta'}</h1>
      <p className="sub">Seus gastos na palma da mão, em 2 toques.</p>
      {mode === 'up' && (
        <label className="field">
          <span>Nome</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" placeholder="Bruno" />
        </label>
      )}
      <label className="field">
        <span>E-mail</span>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" required />
      </label>
      <label className="field">
        <span>Senha</span>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          minLength={6}
          required
        />
      </label>
      {err && <div className="err">{err}</div>}
      {ok && <div className="ok">{ok}</div>}
      <button className="btn" type="submit" disabled={busy} style={{ marginTop: 8 }}>
        {busy ? 'Aguarde…' : mode === 'in' ? 'Entrar' : 'Criar conta'}
      </button>
      <div className="switch">
        {mode === 'in' ? 'Primeira vez? ' : 'Já tem conta? '}
        <button type="button" className="text-btn" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); setOk('') }}>
          {mode === 'in' ? 'Criar conta' : 'Entrar'}
        </button>
      </div>
    </form>
  )
}
