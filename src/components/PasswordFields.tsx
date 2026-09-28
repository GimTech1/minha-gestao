import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Nova senha + confirmação; usado na recuperação por e-mail e em Ajustes
export function PasswordFields({ onDone, submitLabel = 'Salvar nova senha' }: { onDone: () => void; submitLabel?: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const mismatch = confirm.length > 0 && confirm !== password
  const valid = password.length >= 6 && password === confirm

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setErr('')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (!error) return onDone()
    setErr(
      error.message.includes('different from the old') ? 'A nova senha precisa ser diferente da atual' :
      error.message.includes('Password should') || error.message.includes('weak') ? 'Senha fraca: use pelo menos 6 caracteres, misturando letras e números' :
      error.message.includes('session') ? 'O link expirou. Peça um novo em "Esqueci minha senha".' : error.message,
    )
  }

  return (
    <form onSubmit={submit}>
      <label className="field">
        <span>Nova senha</span>
        <div className="pass-wrap">
          <input
            className="input"
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
          <button type="button" className="pass-eye" onClick={() => setShow(!show)}>{show ? 'Ocultar' : 'Mostrar'}</button>
        </div>
      </label>
      <label className="field">
        <span>Repita a nova senha</span>
        <input className="input" type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
      </label>
      {password.length > 0 && password.length < 6 && <div className="hint">Mínimo de 6 caracteres</div>}
      {mismatch && <div className="hint err">As senhas não conferem</div>}
      {err && <div className="hint err">{err}</div>}
      <button className="btn" type="submit" disabled={!valid || busy} style={{ width: '100%', marginTop: 6 }}>
        {busy ? 'Salvando…' : submitLabel}
      </button>
    </form>
  )
}
