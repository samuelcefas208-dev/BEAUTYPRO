/* BelezaPro — avatar padrão de plataforma
   Sem foto real → silhueta de meio-corpo (padrão contacto / WhatsApp).
   Nunca letra do nome. */
(function () {
  "use strict";

  /* Silhueta neutra: cabeça + ombros, fundo cinza quente — estilo contacto sem foto */
  var SILHOUETTE_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">' +
    '<rect width="100" height="100" fill="#E8E6E1"/>' +
    '<circle cx="50" cy="38" r="20" fill="#B8B2A8"/>' +
    '<ellipse cx="50" cy="92" rx="38" ry="32" fill="#B8B2A8"/>' +
    "</svg>";

  var SILHOUETTE_DATA =
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(SILHOUETTE_SVG);

  function avatarDataUrl(/* nome, genero — ignorados de propósito */) {
    return SILHOUETTE_DATA;
  }

  function avatarImgHtml(nome, foto, extraClass) {
    var src = foto || avatarDataUrl();
    return (
      '<div class="avatar bp-avatar-img ' + (extraClass || "") + '">' +
      '<img src="' + src + '" alt="" loading="lazy" decoding="async">' +
      "</div>"
    );
  }

  window.BPAvatars = {
    detectarGenero: function () { return "n"; },
    avatarDataUrl: avatarDataUrl,
    avatarImgHtml: avatarImgHtml,
    defaultSrc: SILHOUETTE_DATA
  };
})();
