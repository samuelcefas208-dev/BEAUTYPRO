# Inventário — arquitectura migrada

**Data:** 2026-08-30  
**Estado:** migração estrutural completa · runtime paths actualizados · funcional

## Estrutura

```
BelezaPro/
├── index.html
├── sw.js
├── manifest.json
├── app.bundle.js          ← shell
├── assets/img/
├── src/
│   ├── app/               ← boot, desktop, hide-splash
│   ├── core/
│   │   ├── state/
│   │   ├── storage/
│   │   ├── sync/
│   │   ├── auth/
│   │   ├── api/
│   │   └── shared/
│   ├── domain/            ← (reservado)
│   ├── modules/
│   │   ├── agenda/
│   │   ├── caixa/
│   │   ├── clientes/
│   │   ├── configuracoes/
│   │   ├── crm/
│   │   ├── dashboard/
│   │   ├── equipa/
│   │   ├── financeiro/
│   │   ├── ia/
│   │   ├── marketing/
│   │   ├── servicos/
│   │   └── vendas/
│   ├── ui/
│   ├── charts/
│   └── media/
├── styles/                ← todo o CSS
├── experiments/piloto-legacy/
└── docs/
    ├── architecture/      ← NAMING, MODULE_MAP, DESIGN_LANGUAGE…
    ├── fase2/             ← policies + tests vivos
    └── history/           ← relatórios antigos
```

## CACHE
`belezapro-shell-v20260830-mig1`

## Nota
Pastas antigas (`core/`, `ui/`, `features/`, `css/`, `boot/`, …) foram removidas.
Todo o carregamento aponta para `src/` e `styles/`.
