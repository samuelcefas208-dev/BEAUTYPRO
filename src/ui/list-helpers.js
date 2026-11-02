/* BelezaPro — helpers de listas (partilhados por módulos de render) */
/** Insere HTML de linhas via DocumentFragment (menos reflow que innerHTML repetido) */
function appendRowsHtml(container, htmlStrings) {
  if (!container || !htmlStrings || !htmlStrings.length) return;
  const frag = document.createDocumentFragment();
  const wrap = document.createElement('div');
  wrap.innerHTML = htmlStrings.join('');
  while (wrap.firstChild) frag.appendChild(wrap.firstChild);
  container.appendChild(frag);
}

/** Sentinel IntersectionObserver para "carregar mais" */
function observeLoadMore(sentinel, onVisible) {
  if (!sentinel || typeof IntersectionObserver === 'undefined') return null;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) onVisible();
    });
  }, { root: null, rootMargin: '120px', threshold: 0 });
  io.observe(sentinel);
  return io;
}

if (typeof window !== 'undefined') {
  window.appendRowsHtml = appendRowsHtml;
  window.observeLoadMore = observeLoadMore;
}
