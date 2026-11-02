# src/ — destino da aplicação

Estrutura mínima e limpa. Ainda vazia de propósito.

```
src/
├── app/       → arranque e coordenação
├── core/      → infraestrutura (state, storage, sync, auth)
├── domain/    → regras puras de negócio
├── modules/   → funcionalidades do produto (agenda, clientes, vendas…)
├── ui/        → componentes e layout reutilizáveis
├── charts/    → gráficos
└── media/     → galeria, avatars, upload
```

Código novo nasce aqui.  
Código antigo só entra quando for tocado e migrado de forma cirúrgica.
