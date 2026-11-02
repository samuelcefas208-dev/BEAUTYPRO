*# domain/ — regras puras de negócio e políticas

Código **sem DOM** e sem side-effects de UI.

```
src/domain/pure/
  ownership-policy.mjs
  salao-isolation-policy.mjs
  sync-queue-policy.mjs
  state-writers-policy.mjs
  ...
```

- Consumido por testes (`Beautypro/tests`) e como contrato documental.
- Runtime de produção continua em scripts clássicos; estas policies **caracterizam** o comportamento esperado (não substituem o bundle no telemóvel).
- Cópia de trabalho também em `docs/fase2/domain/pure` para Vitest legado — **fonte canónica: `src/domain/pure`**.
