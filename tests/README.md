# Testes unitários

```bash
cd docs/fase2
npm install vitest@2.1.8 --no-save
npx vitest run
```

Inclui:
- policies de domain (`src/domain/pure`)
- ownership de módulos (`modules-api.test.js`)
- notificações push (`notificacoes-push.test.js`)

Smoke Node sem Vitest:
```bash
node --input-type=module -e "/* ver scripts de CI locais */"
```
