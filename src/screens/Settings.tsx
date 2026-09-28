import { useEffect, useState } from 'react'
import { useStore, type Category, type Kind } from '../lib/store'
import { supabase, INGEST_URL } from '../lib/supabase'
import { Sheet } from '../components/Sheet'
import { IconNext, IconX } from '../components/icons'
import { PasswordFields } from '../components/PasswordFields'
import { brl } from '../lib/format'

const EMOJIS = ['🍔', '🛒', '🚗', '🏠', '💊', '🎉', '🛍️', '💸', '☕', '🍺', '⛽', '✈️', '🎓', '🐶', '👶', '💇', '🎮', '📱', '💡', '🧾', '🏋️', '🎁', '💰', '📥', '📈', '🏦', '💼', '🧑‍💻', '🍕', '🚌', '🏥', '📦']
// Mesma paleta validada das categorias padrão (dark), + neutro para "outros"
const COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767', '#8b8b9e']

function CategoryEditor({ cat, kind, onClose, notify }: { cat: Category | null; kind: Kind; onClose: () => void; notify: (m: string) => void }) {
  const { saveCategory, deleteCategory, categories, txs } = useStore()
  const [name, setName] = useState(cat?.name ?? '')
  const [emoji, setEmoji] = useState(cat?.emoji ?? '💸')
  const [color, setColor] = useState(cat?.color ?? COLORS[categories.length % COLORS.length])
  const [keywords, setKeywords] = useState((cat?.keywords ?? []).join(', '))
  const used = cat ? txs.filter((t) => t.category_id === cat.id).length : 0

  const save = async () => {
    if (!name.trim()) return
    try {
      await saveCategory({
        id: cat?.id,
        name: name.trim(),
        emoji,
        color,
        kind: cat?.kind ?? kind,
        keywords: keywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean),
        sort: cat?.sort ?? Math.max(0, ...categories.filter((c) => c.sort < 99).map((c) => c.sort)) + 1,
      })
      onClose()
    } catch (e) {
      notify(`Erro: ${(e as Error).message}`)
    }
  }

  const remove = async () => {
    if (!cat) return
    if (used && !confirm(`${used} lançamento(s) ficarão sem categoria. Excluir "${cat.name}"?`)) return
    await deleteCategory(cat.id)
    onClose()
  }

  return (
    <Sheet onClose={onClose}>
      <div className="sheet-h">
        <button className="icon-btn" onClick={onClose} aria-label="Fechar"><IconX /></button>
        <h3>{cat ? 'Editar categoria' : 'Nova categoria'}</h3>
        <button className="text-btn" onClick={save} disabled={!name.trim()}>Salvar</button>
      </div>
      <label className="field">
        <span>Nome</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Pets" />
      </label>
      <div className="field">
        <span>Ícone</span>
        <div className="emoji-grid">
          {EMOJIS.map((e) => (
            <button key={e} className={e === emoji ? 'on' : ''} onClick={() => setEmoji(e)}>{e}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <span>Cor</span>
        <div className="color-row">
          {COLORS.map((c) => (
            <button key={c} className={c === color ? 'on' : ''} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
          ))}
        </div>
      </div>
      <label className="field">
        <span>Palavras-chave (para categorizar automático)</span>
        <textarea className="input" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="petz, cobasi, veterinário" />
      </label>
      {cat && (
        <button className="btn ghost" style={{ width: '100%', color: 'var(--red)' }} onClick={remove}>Excluir categoria</button>
      )}
    </Sheet>
  )
}

function AutomationGuide({ onClose, notify }: { onClose: () => void; notify: (m: string) => void }) {
  const { profile, rotateToken } = useStore()
  const token = profile?.ingest_token ?? ''
  const [testing, setTesting] = useState(false)

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      notify(`${what} copiado`)
    } catch {
      notify('Não consegui copiar; segure o texto para copiar')
    }
  }

  const test = async () => {
    setTesting(true)
    try {
      const res = await fetch(INGEST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-token': token },
        body: JSON.stringify({ text: `Compra aprovada de R$ 0,01 em TESTE DA AUTOMACAO ${Date.now()}` }),
      })
      const data = await res.json()
      if (data.ok && data.id) {
        await supabase.from('transactions').delete().eq('id', data.id)
        notify('✅ Automação funcionando')
      } else notify(`❌ ${data.message ?? 'Falhou'}`)
    } catch {
      notify('❌ Sem conexão')
    } finally {
      setTesting(false)
    }
  }

  const rotate = async () => {
    if (!confirm('Gerar um novo token? Os atalhos atuais param de funcionar até você trocar o token neles.')) return
    await rotateToken()
    notify('Novo token gerado')
  }

  return (
    <Sheet onClose={onClose} full>
      <div className="sheet-h">
        <button className="icon-btn" onClick={onClose} aria-label="Fechar"><IconX /></button>
        <h3>Automações do iPhone</h3>
        <span style={{ width: 36 }} />
      </div>
      <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 20 }}>
        <div className="pill-tip">
          O iOS não deixa nenhum app ler notificações de outros apps. O jeito de automatizar no iPhone é pelo app <b>Atalhos</b>:
          ele lança sozinho suas compras com <b>Apple Pay</b>, os <b>SMS</b> e <b>e-mails</b> do banco, e gastos ditados para a <b>Siri</b>.
        </div>

        <div className="section-h"><h2>Seus dados</h2></div>
        <div className="field">
          <span>URL</span>
          <div className="code" onClick={() => copy(INGEST_URL, 'URL')}>{INGEST_URL}</div>
        </div>
        <div className="field">
          <span>Token (cabeçalho x-token): é a sua senha, não compartilhe</span>
          <div className="code" onClick={() => copy(token, 'Token')}>{token}</div>
        </div>
        <div className="save-row" style={{ marginTop: 0 }}>
          <button className="btn ghost" onClick={test} disabled={testing}>{testing ? 'Testando…' : 'Testar conexão'}</button>
          <button className="btn ghost" onClick={rotate}>Gerar novo token</button>
        </div>

        <div className="section-h"><h2>Base para todos os atalhos</h2></div>
        <div className="card">
          <p className="muted" style={{ fontSize: 14, marginBottom: 10 }}>Todas as automações terminam com a mesma ação:</p>
          <ol className="steps">
            <li>Adicione a ação <b>Obter Conteúdo do URL</b> e cole a <b>URL</b> acima.</li>
            <li>Toque na seta ▸ e defina <b>Método: POST</b>.</li>
            <li>Em <b>Cabeçalhos</b>, adicione: chave <b>x-token</b>, valor = seu <b>token</b>.</li>
            <li>Em <b>Corpo da Solicitação</b>, escolha <b>JSON</b> e adicione os campos de cada automação abaixo.</li>
            <li>(Opcional) Adicione <b>Obter Valor do Dicionário</b> com a chave <b>message</b> e depois <b>Mostrar Notificação</b> com esse valor. Assim você vê "🍔 −R$ 45,90 · Padaria (Alimentação)".</li>
          </ol>
        </div>

        <div className="section-h"><h2>💳 Compras com Apple Pay</h2></div>
        <div className="card">
          <ol className="steps">
            <li>Atalhos → <b>Automação</b> → <b>+</b> → <b>Transação</b>.</li>
            <li>Escolha seus cartões, marque <b>Executar Imediatamente</b> e toque em Seguinte → <b>Nova Automação em Branco</b>.</li>
            <li>Faça a <b>ação base</b> com o corpo JSON:
              <br /><b>amount</b> = variável <i>Quantia</i> (ou <i>Valor</i>) · <b>merchant</b> = <i>Comerciante</i> · <b>card</b> = <i>Cartão ou Passe</i>
              <br /><span className="muted">Toque no campo e escolha as variáveis de <i>Entrada do Atalho</i>.</span>
            </li>
          </ol>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>Toda vez que você aproximar o iPhone ou o Watch, o gasto entra já categorizado.</p>
        </div>

        <div className="section-h"><h2>💬 SMS do banco</h2></div>
        <div className="card">
          <ol className="steps">
            <li>No app do banco, ative alertas de compra e Pix por <b>SMS</b>.</li>
            <li>Atalhos → Automação → <b>+</b> → <b>Mensagem</b> → "A Mensagem Contém" = <b>R$</b> (e, se quiser, o remetente do banco).</li>
            <li>Marque <b>Executar Imediatamente</b>, crie a ação base com o corpo JSON: <b>text</b> = variável <i>Mensagem</i> (ou <i>Conteúdo</i>).</li>
          </ol>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>O app entende Nubank, Itaú, Bradesco, Inter, Santander, C6 e outros, em compras, Pix enviados e Pix recebidos.</p>
        </div>

        <div className="section-h"><h2>📧 E-mail do banco</h2></div>
        <div className="card">
          <ol className="steps">
            <li>Atalhos → Automação → <b>+</b> → <b>E-mail</b> → Remetente = e-mail do banco (ex.: todomundo@nubank.com.br).</li>
            <li>Executar Imediatamente → ação base com <b>text</b> = <i>Conteúdo</i> (ou <i>Assunto</i>).</li>
          </ol>
        </div>

        <div className="section-h"><h2>🎙️ "E aí Siri, anotar gasto"</h2></div>
        <div className="card">
          <ol className="steps">
            <li>Atalhos → <b>+</b> → novo atalho chamado <b>Anotar gasto</b>.</li>
            <li>Ação <b>Ditar Texto</b> e depois a ação base com <b>text</b> = <i>Texto Ditado</i>.</li>
            <li>Fale algo como "<b>35 almoço</b>", "<b>uber 22,50</b>" ou "<b>recebi 1500 freela</b>".</li>
            <li>Dica: coloque no <b>Botão de Ação</b> ou no <b>Toque Traseiro</b> (Ajustes → Acessibilidade → Toque → Toque Traseiro).</li>
          </ol>
        </div>

        <div className="section-h"><h2>📋 Notificação de app do banco</h2></div>
        <div className="card">
          <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5 }}>
            Para notificações que só chegam pelo app (sem SMS nem e-mail): copie o texto do comprovante, abra o <b>+</b> e toque no ícone de
            prancheta. Valor, descrição, tipo e categoria são preenchidos na hora.
          </p>
        </div>
      </div>
    </Sheet>
  )
}

export function Settings({ notify }: { notify: (m: string) => void }) {
  const { profile, categories, txs, catById, updateProfile } = useStore()
  const [session, setSession] = useState<{ user: { email?: string } } | null>(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
  }, [])
  const [name, setName] = useState(profile?.name ?? '')
  const [budget, setBudget] = useState(profile?.monthly_budget ? String(profile.monthly_budget).replace('.', ',') : '')
  const [editing, setEditing] = useState<{ cat: Category | null; kind: Kind } | null>(null)
  const [guide, setGuide] = useState(false)
  const [catKind, setCatKind] = useState<Kind>('expense')
  const [passSheet, setPassSheet] = useState(false)

  const saveProfile = async () => {
    const b = budget.trim() ? Number(budget.replace(/\./g, '').replace(',', '.')) : null
    if (b != null && !(b > 0)) return notify('Orçamento inválido')
    try {
      await updateProfile({ name: name.trim() || null, monthly_budget: b })
      notify('Salvo')
    } catch (e) {
      notify(`Erro: ${(e as Error).message}`)
    }
  }

  const exportCsv = () => {
    const rows = [['data', 'tipo', 'valor', 'categoria', 'descricao', 'forma', 'origem']]
    for (const t of txs) {
      rows.push([
        new Date(t.occurred_at).toLocaleString('pt-BR'),
        t.kind === 'expense' ? 'gasto' : 'receita',
        t.amount.toFixed(2).replace('.', ','),
        (t.category_id && catById.get(t.category_id)?.name) || '',
        t.description ?? '',
        t.method ?? '',
        t.source,
      ])
    }
    const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `minha-gestao-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const dirty = name !== (profile?.name ?? '') || budget !== (profile?.monthly_budget ? String(profile.monthly_budget).replace('.', ',') : '')
  const shownCats = categories.filter((c) => c.kind === catKind)

  return (
    <div className="screen">
      <div className="topbar"><h1>Ajustes</h1></div>

      <div className="card">
        <label className="field">
          <span>Seu nome</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bruno" />
        </label>
        <label className="field" style={{ marginBottom: 14 }}>
          <span>Limite de gastos por mês (opcional)</span>
          <input className="input" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Ex.: 4.000" />
          <div className="hint" style={{ margin: '6px 4px 0' }}>Não é sua renda. Salário e outras entradas vão em Extrato → Previstos → A receber.</div>
        </label>
        <button className="btn" style={{ width: '100%' }} onClick={saveProfile} disabled={!dirty}>Salvar</button>
      </div>

      <div className="section-h"><h2>Automações</h2></div>
      <div className="list">
        <button className="row" onClick={() => setGuide(true)}>
          <span style={{ fontSize: 22 }}>⚡</span>
          <div className="grow">
            <div className="t">Lançar sozinho pelo iPhone</div>
            <div className="s">Apple Pay, SMS, e-mail e Siri</div>
          </div>
          <span className="chev"><IconNext /></span>
        </button>
      </div>

      <div className="section-h">
        <h2>Categorias</h2>
        <button onClick={() => setEditing({ cat: null, kind: catKind })}>+ Nova</button>
      </div>
      <div className="seg" style={{ marginBottom: 10 }}>
        <button className={catKind === 'expense' ? 'on' : ''} onClick={() => setCatKind('expense')}>Gastos</button>
        <button className={catKind === 'income' ? 'on' : ''} onClick={() => setCatKind('income')}>Receitas</button>
      </div>
      <div className="list">
        {shownCats.map((c) => {
          const total = txs.filter((t) => t.category_id === c.id).reduce((s, t) => s + t.amount, 0)
          return (
            <button key={c.id} className="row" onClick={() => setEditing({ cat: c, kind: c.kind })}>
              <span style={{ width: 34, height: 34, borderRadius: 11, display: 'grid', placeItems: 'center', fontSize: 18, background: `color-mix(in srgb, ${c.color} 22%, transparent)` }}>{c.emoji}</span>
              <div className="grow">
                <div className="t">{c.name}</div>
                <div className="s">{c.keywords.length ? `${c.keywords.length} palavras-chave` : 'Sem palavras-chave'} · {brl(total)} no total</div>
              </div>
              <span className="chev"><IconNext /></span>
            </button>
          )
        })}
      </div>

      <div className="section-h"><h2>Dados</h2></div>
      <div className="list">
        <button className="row" onClick={exportCsv}>
          <span style={{ fontSize: 22 }}>📤</span>
          <div className="grow">
            <div className="t">Exportar planilha (CSV)</div>
            <div className="s">{txs.length} lançamentos</div>
          </div>
        </button>
        <button className="row" onClick={() => setPassSheet(true)}>
          <span style={{ fontSize: 22 }}>🔑</span>
          <div className="grow">
            <div className="t">Trocar senha</div>
            <div className="s">{session?.user.email}</div>
          </div>
          <span className="chev"><IconNext /></span>
        </button>
        <button className="row danger" onClick={() => confirm('Sair da conta?') && supabase.auth.signOut()}>
          <span style={{ fontSize: 22 }}>🚪</span>
          <div className="grow"><div className="t">Sair</div></div>
        </button>
      </div>
      <p className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 20 }}>Minha Gestão · feito para o Bruno</p>

      {editing && <CategoryEditor cat={editing.cat} kind={editing.kind} onClose={() => setEditing(null)} notify={notify} />}
      {guide && <AutomationGuide onClose={() => setGuide(false)} notify={notify} />}
      {passSheet && (
        <Sheet onClose={() => setPassSheet(false)}>
          <div className="sheet-h">
            <button className="icon-btn" onClick={() => setPassSheet(false)} aria-label="Fechar"><IconX /></button>
            <h3>Trocar senha</h3>
            <span style={{ width: 36 }} />
          </div>
          <PasswordFields
            onDone={() => {
              setPassSheet(false)
              notify('Senha alterada ✓')
            }}
          />
        </Sheet>
      )}
    </div>
  )
}
