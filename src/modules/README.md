# modules/ — funcionalidades do produto

Cada pasta = uma responsabilidade de negócio.

Padrão alvo (quando o código for migrado):

```
modules/agenda/
├── agenda.js              → lógica principal
├── agenda-render.js       → desenho / HTML
├── agenda-events.js       → interacções
└── agenda-validation.js   → regras (se existir)
```

O mesmo padrão aplica-se a:
dashboard, clientes, vendas, caixa, equipa, servicos,
financeiro, marketing, crm, ia, configuracoes.

Regras:
- Código novo nasce aqui, já com este padrão.
- Código antigo só entra quando for tocado.
- Não misturar responsabilidades de módulos diferentes na mesma pasta.
