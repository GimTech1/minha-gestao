# Minha Gestão

Controle de gastos pessoal, feito para iPhone. É um PWA (instala na tela de início pelo Safari) com Supabase.

- **Lançar em 2 toques**: teclado numérico próprio, categorias ordenadas pelo uso, sugestões pelo histórico.
- **Colar notificação**: copie o texto de um Pix ou compra e toque na prancheta; o app preenche tudo.
- **Automático pelo iPhone**: Atalhos do iOS enviam compras do Apple Pay, SMS e e-mails do banco e gastos ditados à Siri para a Edge Function `ingest`.
- **Offline**: abre instantâneo pelo cache e sincroniza quando voltar a rede.

## Rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # testes do parser de mensagens de banco
```

## Estrutura

- `src/lib/parser.ts`: entende mensagens de Nubank, Itaú, Bradesco, Inter etc. e texto livre ("35 almoço"). Mesmo arquivo usado na Edge Function.
- `supabase/functions/ingest`: endpoint dos Atalhos (autentica pelo `ingest_token` do perfil).
- `supabase/migrations`: schema com RLS.

Deploy: todo push na `main` publica no GitHub Pages (`.github/workflows/deploy.yml`).
Ao alterar `src/lib/parser.ts`, copie para `supabase/functions/ingest/parser.ts` e publique a função de novo.
