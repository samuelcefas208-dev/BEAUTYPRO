# Camada `src/app/` — Contrato (Etapa 5)

## Regra

| Camada | Pode | Não pode |
|--------|------|----------|
| **app/** | Boot, SW, deferred loads, overlay, splash, menu/logout shell, `updateUI` | Preço, comissão, CRUD domínio, validar formulários de negócio, HTML de listas |
| **modules/** | Regras e events do domínio | Orquestrar boot global |
| **core/** | Persistência, sync, auth, state | UI de abas |

## Ficheiros

| Ficheiro | Papel |
|----------|--------|
| `main.js` | `init`, migrations call, deferred loaders, overlay, padding shell |
| `boot-migrations.js` | One-shot migrations (flags localStorage) |
| `app-shell-events.js` | Signup toast, menu, logout |
| `ui-coordinator.js` | `updateUI` debounce + tab routing |
| `hide-splash.js` | Splash |
| `desktop-*.js` | Shell desktop (diferido) |

## Proibição

Não acrescentar em `main.js` listeners de `modal-venda`, `fab-agendar`, `add-cliente`, etc.
