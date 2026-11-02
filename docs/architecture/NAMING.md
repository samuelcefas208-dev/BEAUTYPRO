# BelezaPro — Convenção Oficial de Nomes

**Objectivo:** nomes que digam o que o ficheiro faz, não a história de como nasceu.

---

## 1. Regras simples

- Nome = responsabilidade clara
- Preferir português técnico ou inglês curto e estável
- Usar kebab-case (`agenda-render.js`, `sync-queue.js`)
- Evitar números de fase, “final”, “extra”, “novo”, “v2”, “piloto”, “temp”, “fix”
- Um ficheiro = uma responsabilidade principal

---

## 2. Pastas principais (destino)

| Pasta          | Responsabilidade                          |
|----------------|-------------------------------------------|
| `src/app/`     | Arranque, lifecycle, navegação            |
| `src/core/`    | Infraestrutura (state, storage, sync, auth) |
| `src/domain/`  | Regras puras de negócio                   |
| `src/modules/` | Funcionalidades do produto                |
| `src/ui/`      | Componentes e layout reutilizáveis        |
| `src/charts/`  | Gráficos                                  |
| `src/media/`   | Galeria, avatars, upload                  |
| `styles/`      | Todo o CSS                                |
| `assets/`      | Imagens, ícones, fonts                    |
| `docs/`        | Documentação activa                       |
| `docs/history/`| Relatórios e fases antigas                |
| `experiments/` | Código ainda não promovido (ex-piloto)    |

---

## 3. Ficheiros dentro de um módulo

Exemplo para agenda:

```
modules/agenda/
  agenda.js            → lógica principal
  agenda-render.js     → HTML / desenho
  agenda-events.js     → cliques e interacções
  agenda-validation.js → regras de validação (se existir)
```

O mesmo padrão serve para clientes, vendas, caixa, equipa, etc.

---

## 4. Nomes a evitar → nomes preferidos

| Evitar                    | Preferir                  |
|---------------------------|---------------------------|
| marketing-fase2.js        | marketing.js              |
| gestao-fase78.js          | gestao.js                 |
| finance-fase1-extra.js    | financeiro.js / comissoes.js |
| equipa-fase3.js           | equipa.js                 |
| agenda-polish.js          | agenda-render.js          |
| design-system-final.css   | components.css / tokens.css |
| design-tokens-extra.css   | tokens.css                |
| bp-resumo-kpi.js          | dashboard-kpis.js         |
| eventos-globais.js        | app-events.js             |
| eventos-cadastros.js      | (dividir por módulo)      |
| eventos-caixa-vendas.js   | caixa-events.js / vendas-events.js |
| piloto/                   | experiments/              |

---

## 5. CSS

- `styles/foundation/` → tokens, reset, tipografia
- `styles/layout/` → app, navegação, responsive
- `styles/components/` → modal, botões, formulários, tabelas
- `styles/modules/` → dashboard, agenda, vendas, ia…
- `styles/themes/` → dark, print

---

## 6. Documentação

- Documentação activa → `docs/architecture/`, `docs/contracts/`, `docs/security/`
- Tudo o que é histórico de fases → `docs/history/`

---

## 7. Regra de ouro para código novo

Todo ficheiro novo já nasce com nome limpo e na pasta correcta.
Código antigo só muda de nome quando for tocado.

---

*Documento vivo. Actualizar só quando a convenção evoluir de forma consciente.*
