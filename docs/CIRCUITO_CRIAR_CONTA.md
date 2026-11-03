# Circuito Criar conta — fecho

## Cadeia completa

```
Login → Criar conta (wizard 6 passos)
  1 Bem-vindo
  2 Como funciona
  3 Empresa (+ NIF opcional)
  4 Conta (email + password)
  5 Termos (checkbox)
  6 Confirmar → signUp(Supabase)
        │
        ├─ session null + user → login + mensagem "confirme o email"
        ├─ session + user → signOut local → login + mensagem "inicie sessão"
        └─ erro → banner + erro no campo (email já existe, password, rede, rate limit)
Login (email pré-preenchido)
  → Auth OK
  → profile + salao_id? → app
  → sem profile → painel onboarding (F5) → provision-empresa → app
```

## Fechado

- Validação por passo + revalidação no submit (3,4,5)
- Erros no campo + banner (sem toast no wizard)
- Seta voltar sem texto
- Split visual + formulário
- Metadata empresa/nif_bi no signUp
- F5 onboarding separado (não inventa salao_id no cliente)
- JS sintaxe validada (node --check)

## Dependência externa

- Edge `provision-empresa` no Supabase (F5)
- Confirmação de email conforme config Auth do projecto
