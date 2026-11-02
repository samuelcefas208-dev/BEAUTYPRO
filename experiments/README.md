# experiments/ — código ainda não promovido

Aqui vive o que antes era `piloto/`.

Conteúdo actual:
- piloto-legacy/   → charts boundary + fatias experimentais (ainda referenciado no runtime)

Regra:
- Nada daqui entra no runtime de produção sem promoção formal.
- Quando validado → move para `src/`.
- Até lá, as referências em index.html e sw.js apontam para piloto-legacy.
