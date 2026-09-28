import { useState } from 'react'
import { supabase } from '../lib/supabase'

type Mode = 'in' | 'up' | 'reset'

const TITLES: Record<Mode, string> = { in: 'Bem-vindo de volta', up: 'Criar sua conta', reset: 'Recuperar senha' }

export function Login() {
  const [mode, setMode] = useState<Mode>('in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  const go = (m: Mode) => {
    setMode(m)
    setErr('')
    setOk('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setOk('')
    setBusy(true)
    const redirectTo = window.location.origin + import.meta.env.BASE_URL
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else if (mode === 'up') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() }, emailRedirectTo: redirectTo },
        })
        if (error) throw error
        if (!data.session) setOk('Conta criada! Confirme pelo link que enviamos para o seu e-mail e depois entre aqui.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
        if (error) throw error
        setOk('Pronto! Se esse e-mail tiver conta, você vai receber um link para criar uma nova senha. Veja também o spam.')
      }
    } catch (e) {
      const msg = (e as Error).message
      setErr(
        msg.includes('Invalid login') ? 'E-mail ou senha incorretos' :
        msg.includes('Email not confirmed') ? 'Confirme seu e-mail antes de entrar' :
        msg.includes('already registered') ? 'Esse e-mail já tem conta. Entre com sua senha.' :
        msg.includes('Password should') ? 'A senha precisa ter pelo menos 6 caracteres' :
        msg.includes('email rate limit') ? 'O envio de e-mails do app está no limite agora. Tente de novo mais tarde.' :
        msg.includes('rate limit') || msg.includes('seconds') ? 'Muitas tentativas. Espere alguns minutos e tente de novo.' :
        msg.includes('sending') ? 'Não consegui enviar o e-mail agora. Tente mais tarde.' : msg,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="login" onSubmit={submit}>
      <img className="logo" src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" />
      <h1>{TITLES[mode]}</h1>
      <p className="sub">
        {mode === 'reset' ? 'Informe seu e-mail e enviamos um link para você criar uma nova senha.' : 'Seus gastos na palma da mão, em 2 toques.'}
      </p>
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
      {mode !== 'reset' && (
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
      )}
      {mode === 'in' && (
        <button type="button" className="text-btn forgot" onClick={() => go('reset')}>Esqueci minha senha</button>
      )}
      {err && <div className="err">{err}</div>}
      {ok && <div className="ok">{ok}</div>}
      <button className="btn" type="submit" disabled={busy} style={{ marginTop: 8 }}>
        {busy ? 'Aguarde…' : mode === 'in' ? 'Entrar' : mode === 'up' ? 'Criar conta' : 'Enviar link'}
      </button>
      <div className="switch">
        {mode === 'reset' ? (
          <button type="button" className="text-btn" onClick={() => go('in')}>← Voltar para o login</button>
        ) : (
          <>
            {mode === 'in' ? 'Primeira vez? ' : 'Já tem conta? '}
            <button type="button" className="text-btn" onClick={() => go(mode === 'in' ? 'up' : 'in')}>
              {mode === 'in' ? 'Criar conta' : 'Entrar'}
            </button>
          </>
        )}
      </div>
    </form>
  )
}
