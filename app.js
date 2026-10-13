/* Veladoras Super Mar Mass · Sucursal Izúcar de Matamoros */
(function () {
  "use strict";

  var PHONE = (window.CATALOGO_CONFIG || {}).TELEFONO_NUMERO || "9535340450";
  var CFG = window.CATALOGO_CONFIG || {};
  var WA = CFG.WHATSAPP_NUMERO;
  var SUCURSAL = (window.CATALOGO_CONFIG || {}).SUCURSAL || "Sucursal Izúcar de Matamoros";
  var CART_KEY = "smm-izucar-pedido-v2";
  var CLIENT_KEY = "smm-izucar-entrega-v2";
  try { localStorage.removeItem("smm-izucar-cliente-v1"); localStorage.removeItem("smm-izucar-pedido-v1"); } catch (e) {}

  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  var cover = $("#cover"), app = $("#app"), grid = $("#grid"), chipsEl = $("#brand-chips");
  var searchEl = $("#search"), countEl = $("#result-count"), backdrop = $("#sheet-backdrop");
  var detail = $("#detail-sheet"), detailContent = $("#sheet-content");
  var cartSheet = $("#cart-sheet"), cartContent = $("#cart-content");
  var cartBar = $("#cart-bar"), toastEl = $("#toast");

  var products = [], byId = {}, brands = [], activeBrand = "Todas", query = "";
  var cart = loadJSON(CART_KEY, {});      // { id: cantidad }
  var client = {}; var savedEntrega = loadJSON(CLIENT_KEY, "Envío a domicilio");
  ["nombre","tel","negocio","calle","colonia","ciudad","refs","nota"].forEach(function (k) { if (typeof client[k] !== "string") client[k] = ""; });
  function blankClient() { client = { nombre: "", tel: "", negocio: "", calle: "", colonia: "", ciudad: "", refs: "", nota: "", entrega: savedEntrega === "Recoger en tienda" ? "Recoger en tienda" : "Envío a domicilio" }; }
  blankClient();
  var showErrors = false;
  var openSheetEl = null;

  function loadJSON(k, def) { try { var v = JSON.parse(localStorage.getItem(k)); return v && typeof v === "object" ? v : def; } catch (e) { return def; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function isNative() { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
  function openExternal(url) {
    if (isNative() || url.indexOf("tel:") === 0) { window.location.href = url; }
    else { var w = window.open(url, "_blank", "noopener"); if (!w) window.location.href = url; }
  }

  function imgSrc(p) { return p.imagen ? "img/productos/" + encodeURIComponent(p.imagen) : "img/logo.webp"; }
  function fmt(n) { return "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function unidadPlural(p, n) {
    if (p.unidad === "pieza") return n === 1 ? "pieza" : "piezas";
    return n === 1 ? "caja" : "cajas";
  }
  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function toast(msg, ms) {
    toastEl.textContent = msg; toastEl.classList.toggle("ok", msg.indexOf("✅") === 0); toastEl.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { toastEl.classList.remove("show"); }, ms || 1600);
  }

  /* ---------- Catálogo ---------- */
  function filtered() {
    var q = norm(query.trim());
    return products.filter(function (p) {
      if (activeBrand !== "Todas" && p.marca !== activeBrand) return false;
      if (!q) return true;
      return norm(p.nombre + " " + p.codigo + " " + p.marca + " " + p.presentacion + " " + p.descripcion_original).indexOf(q) !== -1;
    });
  }

  function renderChips() {
    chipsEl.innerHTML = "";
    ["Todas"].concat(brands).forEach(function (b) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip" + (b === activeBrand ? " is-active" : "");
      btn.textContent = b;
      btn.setAttribute("aria-pressed", b === activeBrand ? "true" : "false");
      btn.addEventListener("click", function () { activeBrand = b; renderChips(); renderGrid(); });
      chipsEl.appendChild(btn);
    });
  }

  function cardHTML(p, i) {
    var q = cart[p.id] || 0;
    return '<article class="card" role="button" tabindex="0" data-id="' + p.id + '" style="animation-delay:' + Math.min(i * 20, 200) + 'ms">' +
      '<div class="card-photo' + (p.imagen ? '' : ' no-foto') + '"><img src="' + esc(imgSrc(p)) + '" alt="' + esc(p.nombre) + '" loading="lazy" decoding="async" />' + (p.imagen ? '' : '<span class="foto-prox">Foto próximamente</span>') + '</div>' +
      '<div class="card-body">' +
      '<div class="card-marca">' + esc(p.marca) + '</div>' +
      '<div class="card-nombre">' + esc(p.nombre) + '</div>' +
      '<div class="card-clave">Código ' + esc(p.codigo) + '</div>' +
      '<div class="card-pres">' + esc(p.presentacion) + '</div>' +
      '<div class="card-precio">' + fmt(p.precio) + '<small>' + esc(p.precio_nota) + '</small><small class="pz">' + fmt(p.precio_pieza) + ' por ' + esc(p.precio_pieza_unidad) + '</small></div>' +
      '<button type="button" class="card-add' + (q ? " in-cart" : "") + '" data-add="' + p.id + '">' +
      (q ? "✓ " + q + " en pedido" : "+ Agregar") + '</button>' +
      '</div></article>';
  }

  function renderGrid() {
    var list = filtered();
    countEl.textContent = list.length === products.length ? list.length + " productos" : list.length + " de " + products.length + " productos";
    if (!list.length) {
      grid.innerHTML = '<div class="empty"><p>No hay productos con ese filtro.</p><p>Prueba otra marca o limpia la búsqueda.</p></div>';
      return;
    }
    grid.innerHTML = list.map(cardHTML).join("");
  }

  /* ---------- Hojas ---------- */
  function showSheet(el) {
    if (openSheetEl && openSheetEl !== el) { openSheetEl.classList.remove("is-open"); openSheetEl.hidden = true; }
    openSheetEl = el;
    backdrop.hidden = false; el.hidden = false;
    requestAnimationFrame(function () { backdrop.classList.add("is-open"); el.classList.add("is-open"); });
    document.body.classList.add("sheet-open");
  }
  function closeSheet() {
    var el = openSheetEl; if (!el) return;
    openSheetEl = null;
    backdrop.classList.remove("is-open"); el.classList.remove("is-open");
    document.body.classList.remove("sheet-open");
    setTimeout(function () { if (!el.classList.contains("is-open")) { el.hidden = true; if (!openSheetEl) backdrop.hidden = true; } }, 320);
  }

  function stepperHTML(id, val, min) {
    return '<span class="stepper" data-stepper="' + id + '">' +
      '<button type="button" data-step="-1" aria-label="Menos">−</button>' +
      '<input type="number" inputmode="numeric" min="' + min + '" max="999" value="' + val + '" aria-label="Cantidad" />' +
      '<button type="button" data-step="1" aria-label="Más">+</button></span>';
  }

  function openDetail(p) {
    var q = cart[p.id] || 1;
    detailContent.innerHTML =
      '<div class="sheet-photo' + (p.imagen ? '' : ' no-foto') + '"><img src="' + esc(imgSrc(p)) + '" alt="' + esc(p.nombre) + '" />' + (p.imagen ? '' : '<span class="foto-prox">Foto próximamente</span>') + '</div>' +
      '<p class="sheet-marca">' + esc(p.marca) + '</p>' +
      '<h2 class="sheet-nombre" id="sheet-nombre">' + esc(p.nombre) + '</h2>' +
      '<div class="sheet-meta">' +
      '<span class="badge badge-code">Código ' + esc(p.codigo) + '</span>' +
      (p.presentacion ? '<span class="badge">' + esc(p.presentacion) + '</span>' : '') +
      '</div>' +
      '<p class="sheet-precio">' + fmt(p.precio) + ' <span style="font-size:.9rem">MXN</span><small>' + esc(p.precio_nota) + '</small></p>' +
      '<p class="sheet-pieza">Precio por ' + esc(p.precio_pieza_unidad) + ': <strong>' + fmt(p.precio_pieza) + '</strong></p>' +
      '<div class="sheet-actions">' +
      '<div class="add-row">' + stepperHTML("detail", q, 1) +
      '<button type="button" class="btn btn-primary" id="detail-add" data-id="' + p.id + '">🛒 ' + (cart[p.id] ? "Actualizar" : "Agregar") + ' ' + (p.unidad === "pieza" ? "piezas" : "cajas") + '</button></div>' +
      '<div class="contact-row">' +
      '<a class="btn btn-wa" data-ext href="' + esc(waProduct(p)) + '">💬 WhatsApp</a>' +
      '<a class="btn btn-secondary" data-ext href="tel:' + PHONE + '">📞 Llamar</a>' +
      '</div>' +
      '</div>';
    showSheet(detail);
  }

  function waProduct(p) {
    var L = [
      "🕯️ *CONSULTA DE PRODUCTO*",
      "🏪 *" + SUCURSAL + "*",
      "━━━━━━━━━━━━━━",
      "*" + p.nombre + "*",
      "▫️ Marca: " + p.marca,
      "▫️ Código: " + p.codigo + " · " + p.presentacion,
      "▫️ Precio neto: *" + money(p.precio) + "* por caja",
      "▫️ Por " + (p.precio_pieza_unidad || "pieza") + ": " + money(p.precio_pieza),
      "━━━━━━━━━━━━━━",
      "Hola 👋, ¿me confirma disponibilidad de este producto?",
      "_Gracias._"
    ];
    return "https://wa.me/" + WA + "?text=" + encodeURIComponent(L.join("\n"));
  }

  /* ---------- Pedido ---------- */
  function cartItems() {
    return Object.keys(cart).filter(function (id) { return byId[id] && cart[id] > 0; })
      .map(function (id) { return { p: byId[id], q: cart[id], sub: byId[id].precio * cart[id] }; });
  }
  function unitsLabel(items, n) {
    var kinds = {}; items.forEach(function (it) { kinds[it.p.unidad === "pieza" ? "pieza" : "caja"] = 1; });
    var k = Object.keys(kinds);
    if (k.length === 1 && k[0] === "pieza") return n + (n === 1 ? " pieza" : " piezas");
    if (k.length === 1) return n + (n === 1 ? " caja" : " cajas");
    return n + (n === 1 ? " unidad" : " unidades");
  }
  function cartTotals() {
    var items = cartItems(), total = 0, units = 0;
    items.forEach(function (it) { total += it.sub; units += it.q; });
    return { items: items, total: total, units: units };
  }
  function setQty(id, q) {
    q = Math.max(0, Math.min(999, parseInt(q, 10) || 0));
    if (q) cart[id] = q; else delete cart[id];
    saveJSON(CART_KEY, cart);
    updateCartBar(); renderGrid();
  }
  function updateCartBar() {
    var t = cartTotals();
    if (!t.items.length) { cartBar.hidden = true; return; }
    cartBar.hidden = false;
    $("#cart-bar-count").textContent = "· " + t.items.length + (t.items.length === 1 ? " producto" : " productos") + " · " + unitsLabel(t.items, t.units);
    $("#cart-bar-total").textContent = fmt(t.total);
    cartBar.classList.remove("bump"); void cartBar.offsetWidth; cartBar.classList.add("bump");
  }

  function renderCart() {
    var t = cartTotals();
    if (!t.items.length) {
      cartContent.innerHTML = '<h2 class="cart-title" id="cart-title">Mi pedido</h2>' +
        '<div class="cart-empty"><i class="flor"></i><p>Tu pedido está vacío.</p><p>Toca <strong>+ Agregar</strong> en los productos.</p></div>';
      return;
    }
    cartContent.innerHTML =
      '<h2 class="cart-title" id="cart-title">Mi pedido</h2>' +
      '<p class="cart-sub">' + SUCURSAL + ' · precios netos por caja</p>' +
      '<ul class="cart-list">' + t.items.map(function (it) {
        return '<li class="cart-item"><img src="' + esc(imgSrc(it.p)) + '" alt="" />' +
          '<div><div class="cart-item-name">' + esc(it.p.nombre) + '</div>' +
          '<div class="cart-item-code">' + esc(it.p.codigo) + ' · ' + esc(it.p.presentacion) + '</div>' +
          '<div class="cart-item-row">' + stepperHTML(it.p.id, it.q, 0) +
          '<div style="text-align:right"><div class="cart-item-sub">' + fmt(it.sub) + '</div>' +
          '<div class="cart-item-unit">' + fmt(it.p.precio) + ' / ' + (it.p.unidad === "pieza" ? "pieza" : "caja") + '</div></div>' +
          '</div></div></li>';
      }).join("") + '</ul>' +
      '<div class="cart-total"><span>Total (' + unitsLabel(t.items, t.units) + ')</span><strong>' + fmt(t.total) + '</strong></div>' +
      clientFormHTML() +
      '<div class="sheet-actions">' +
      '<button type="button" class="btn btn-wa" id="cart-send">💬 Enviar pedido por WhatsApp</button>' +
      '<a class="btn btn-secondary" data-ext href="tel:' + PHONE + '">📞 Llamar ' + (CFG.TELEFONO_TEXTO || PHONE) + '</a>' +
      '<button type="button" class="btn-link" id="cart-clear">Vaciar pedido</button>' +
      '</div>';
  }

  function money(n) {
    var p = (Math.round(n * 100) / 100).toFixed(2).split(".");
    return "$" + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + p[1];
  }
  function fechaHora() {
    var d = new Date(), z = function (x) { return (x < 10 ? "0" : "") + x; };
    var h = d.getHours(), ap = h < 12 ? "a. m." : "p. m.", h12 = h % 12 || 12;
    return z(d.getDate()) + "/" + z(d.getMonth() + 1) + "/" + d.getFullYear() + " · " + h12 + ":" + z(d.getMinutes()) + " " + ap;
  }
  function fieldHTML(id, label, opts) {
    opts = opts || {};
    var v = client[id] || "", err = showErrors ? validate()[id] : "";
    var input = opts.textarea
      ? '<textarea id="cli-' + id + '" placeholder="' + esc(opts.ph || "") + '">' + esc(v) + '</textarea>'
      : '<input id="cli-' + id + '" type="' + (opts.type || "text") + '"' + (opts.mode ? ' inputmode="' + opts.mode + '"' : '') + (opts.ac ? ' autocomplete="' + opts.ac + '"' : '') + (opts.max ? ' maxlength="' + opts.max + '"' : '') + ' value="' + esc(v) + '" placeholder="' + esc(opts.ph || "") + '" />';
    return '<label class="cart-field' + (err ? ' has-error' : '') + '">' +
      '<span>' + label + (opts.req ? ' <b class="req">*</b>' : ' <em class="opt">(opcional)</em>') + '</span>' + input +
      '<small class="field-error" data-err="' + id + '">' + esc(err || "") + '</small></label>';
  }
  function clientFormHTML() {
    var dom = client.entrega === "Envío a domicilio";
    return '<section class="client-form" aria-labelledby="cf-title">' +
      '<h3 class="cf-title" id="cf-title">👤 Datos del cliente</h3>' +
      '<p class="cf-sub">Datos de este pedido. Se limpian al enviarlo.</p>' +
      fieldHTML("nombre", "Nombre completo", { req: 1, ac: "name", ph: "Ej. María López Hernández" }) +
      fieldHTML("tel", "Teléfono / WhatsApp", { req: 1, type: "tel", mode: "numeric", ac: "tel", max: 14, ph: "10 dígitos, ej. 238 123 4567" }) +
      fieldHTML("negocio", "Nombre del negocio / tienda", { ac: "organization", ph: "Ej. Abarrotes La Esperanza" }) +
      '<label class="cart-field"><span>Forma de entrega <b class="req">*</b></span>' +
      '<select id="cli-entrega"><option' + (dom ? ' selected' : '') + '>Envío a domicilio</option><option' + (!dom ? ' selected' : '') + '>Recoger en tienda</option></select></label>' +
      '<h4 class="cf-sub2">📍 Dirección' + (dom ? '' : ' <em class="opt">(opcional al recoger en tienda)</em>') + '</h4>' +
      fieldHTML("calle", "Calle y número", { req: dom, ac: "address-line1", ph: "Ej. Av. Hidalgo 123" }) +
      fieldHTML("colonia", "Colonia", { ac: "address-line2", ph: "Ej. Centro" }) +
      fieldHTML("ciudad", "Ciudad / Municipio", { req: dom, ac: "address-level2", ph: "Ej. Izúcar de Matamoros" }) +
      fieldHTML("refs", "Referencias", { ph: "Ej. Frente al mercado, portón verde" }) +
      fieldHTML("nota", "Nota", { textarea: 1, ph: "Ej. Entregar por la tarde" }) +
      '</section>';
  }
  function telDigits() { var d = (client.tel || "").replace(/\D/g, ""); if (d.length === 12 && d.indexOf("52") === 0) d = d.slice(2); if (d.length === 13 && d.indexOf("521") === 0) d = d.slice(3); return d; }
  function validate() {
    var e = {}, t = function (k) { return (client[k] || "").trim(); };
    if (t("nombre").length < 3) e.nombre = "Escribe tu nombre completo.";
    else if (t("nombre").split(/\s+/).length < 2) e.nombre = "Escribe nombre y apellido.";
    var d = telDigits();
    if (!d) e.tel = "Escribe tu teléfono o WhatsApp.";
    else if (d.length !== 10) e.tel = "El teléfono debe tener 10 dígitos (tienes " + d.length + ").";
    if (client.entrega === "Envío a domicilio") {
      if (t("calle").length < 3) e.calle = "Para envío a domicilio, escribe calle y número.";
      if (t("ciudad").length < 2) e.ciudad = "Escribe la ciudad o municipio.";
    }
    return e;
  }
  function telFmt() { var d = telDigits(); return d.length === 10 ? d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6) : client.tel; }
  function orderMessage() {
    var t = cartTotals(), SEP = "━━━━━━━━━━━━━━", L = [];
    L.push("🕯️ *NUEVO PEDIDO · VELADORAS*");
    L.push("🏪 *" + SUCURSAL + "*");
    L.push("📅 " + fechaHora());
    var c = function (k) { return (client[k] || "").trim().replace(/\s+/g, " "); };
    L.push("");
    L.push("👤 *DATOS DEL CLIENTE*");
    L.push("▫️ Nombre: " + c("nombre"));
    L.push("▫️ Tel: " + telFmt());
    if (c("negocio")) L.push("▫️ Negocio: " + c("negocio"));
    var dir = [c("calle"), c("colonia") ? "Col. " + c("colonia").replace(/^col(onia)?\.?\s*/i, "") : "", c("ciudad")].filter(Boolean).join(", ");
    if (dir) L.push("📍 *Dirección:* " + dir);
    if (c("refs")) L.push("▫️ Ref: " + c("refs"));
    L.push("🚚 Entrega: *" + client.entrega + "*");
    if (c("nota")) L.push("📝 Nota: _" + c("nota") + "_");
    L.push(SEP);
    t.items.forEach(function (it, i) {
      if (i) L.push("");
      L.push("*" + (i + 1) + ". " + it.p.nombre + "*");
      L.push("   ▫️ Código: " + it.p.codigo + " · " + it.p.presentacion);
      L.push("   ▫️ " + it.q + " " + unidadPlural(it.p, it.q) + " × " + money(it.p.precio) + " = *" + money(it.sub) + "*");
    });
    L.push(SEP);
    L.push("📦 Total de cajas: " + t.units + " · Productos: " + t.items.length);
    L.push("💰 *TOTAL: " + money(t.total) + " MXN*");
    L.push("");
    L.push("_Precios netos sujetos a disponibilidad._");
    L.push("¡Gracias por su pedido! 🙌");
    return L.join("\n");
  }

  function resetAfterSend() {
    cart = {}; saveJSON(CART_KEY, cart);
    blankClient(); showErrors = false;
    query = ""; searchEl.value = ""; activeBrand = "Todas";
    closeSheet();
    cover.classList.add("hidden"); cover.setAttribute("aria-hidden", "true"); app.classList.add("is-visible");
    renderChips(); renderGrid(); updateCartBar(); renderCart();
    chipsEl.scrollLeft = 0;
    var top = function () { window.scrollTo({ top: 0, left: 0, behavior: "instant" }); document.documentElement.scrollTop = 0; };
    top(); setTimeout(top, 350);
    toast("✅ Pedido enviado. Listo para tomar otro pedido", 3500);
  }

  /* ---------- Eventos ---------- */
  function enterCatalog() {
    cover.classList.add("is-leaving");
    setTimeout(function () { cover.classList.add("hidden"); cover.setAttribute("aria-hidden", "true"); app.classList.add("is-visible"); updateCartBar(); }, 400);
  }

  function bind() {
    $("#btn-ver-catalogo").addEventListener("click", enterCatalog);

    var timer;
    searchEl.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(function () { query = searchEl.value; renderGrid(); }, 120); });

    grid.addEventListener("click", function (e) {
      var add = e.target.closest("[data-add]");
      if (add) {
        e.stopPropagation();
        var id = add.getAttribute("data-add");
        if (cart[id]) { openDetail(byId[id]); return; }
        setQty(id, 1); toast("Agregado: " + byId[id].nombre);
        return;
      }
      var card = e.target.closest(".card");
      if (card && byId[card.getAttribute("data-id")]) openDetail(byId[card.getAttribute("data-id")]);
    });
    grid.addEventListener("keydown", function (e) {
      if ((e.key !== "Enter" && e.key !== " ") || e.target.closest("[data-add]")) return;
      var card = e.target.closest(".card"); if (!card) return;
      e.preventDefault(); openDetail(byId[card.getAttribute("data-id")]);
    });

    // steppers (detalle y pedido)
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-step]"); if (!b) return;
      var st = b.closest("[data-stepper]"), inp = st.querySelector("input");
      var min = parseInt(inp.min, 10) || 0;
      var v = Math.max(min, Math.min(999, (parseInt(inp.value, 10) || 0) + parseInt(b.getAttribute("data-step"), 10)));
      inp.value = v;
      var id = st.getAttribute("data-stepper");
      if (id !== "detail") { setQty(id, v); renderCart(); }
    });
    document.addEventListener("change", function (e) {
      var st = e.target.closest("[data-stepper]"); if (!st) return;
      var id = st.getAttribute("data-stepper");
      if (id !== "detail") { setQty(id, e.target.value); renderCart(); }
    });
    document.addEventListener("input", function (e) {
      if (e.target.id && e.target.id.indexOf("cli-") === 0) {
        client[e.target.id.slice(4)] = e.target.value;
        if (showErrors) {
          var errs = validate();
          cartContent.querySelectorAll("[data-err]").forEach(function (el) {
            var m = errs[el.getAttribute("data-err")] || ""; el.textContent = m;
            el.parentNode.classList.toggle("has-error", !!m);
          });
        }
      }
    });
    document.addEventListener("change", function (e) {
      if (e.target.id === "cli-entrega") {
        client.entrega = savedEntrega = e.target.value; saveJSON(CLIENT_KEY, savedEntrega);
        var y = cartContent.parentNode.scrollTop; renderCart(); cartContent.parentNode.scrollTop = y;
      }
    });

    detail.addEventListener("click", function (e) {
      var b = e.target.closest("#detail-add"); if (!b) return;
      var q = parseInt(detail.querySelector("[data-stepper] input").value, 10) || 1;
      var p = byId[b.getAttribute("data-id")];
      setQty(p.id, q); closeSheet();
      toast("En tu pedido: " + q + " " + unidadPlural(p, q) + " · " + p.nombre);
    });

    cartBar.addEventListener("click", function () { renderCart(); showSheet(cartSheet); });
    cartSheet.addEventListener("click", function (e) {
      if (e.target.closest("#cart-send")) {
        if (!cartItems().length) return;
        var errs = validate();
        if (Object.keys(errs).length) {
          showErrors = true; var y = cartContent.scrollTop; renderCart();
          var first = cartContent.querySelector(".has-error input, .has-error textarea");
          if (first) { first.scrollIntoView({ block: "center", behavior: "smooth" }); first.focus({ preventScroll: true }); }
          toast("Revisa los datos marcados en rojo");
          return;
        }
        showErrors = false;
        var waUrl = "https://wa.me/" + WA + "?text=" + encodeURIComponent(orderMessage());
        resetAfterSend();
        openExternal(waUrl);
      } else if (e.target.closest("#cart-clear")) {
        if (window.confirm("¿Vaciar todo el pedido?")) { cart = {}; saveJSON(CART_KEY, cart); updateCartBar(); renderGrid(); renderCart(); }
      }
    });

    // enlaces externos (tel / WhatsApp)
    document.addEventListener("click", function (e) {
      var a = e.target.closest("a[data-ext]"); if (!a) return;
      e.preventDefault(); openExternal(a.getAttribute("href"));
    });

    Array.prototype.forEach.call(document.querySelectorAll(".sheet-close"), function (b) { b.addEventListener("click", closeSheet); });
    backdrop.addEventListener("click", closeSheet);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });

    [detail, cartSheet].forEach(function (sh) {
      var startY = null, sc = sh.querySelector(".sheet-scroll");
      sh.addEventListener("touchstart", function (e) { startY = sc.scrollTop > 0 ? null : e.touches[0].clientY; }, { passive: true });
      sh.addEventListener("touchend", function (e) { if (startY == null) return; var dy = e.changedTouches[0].clientY - startY; startY = null; if (dy > 80) closeSheet(); }, { passive: true });
    });

    // botón atrás de Android cierra hojas
    document.addEventListener("backbutton", function () { closeSheet(); }, false);
  }

  function applyConfig() {
    document.querySelectorAll("[data-wa-link]").forEach(function (el) { el.href = "https://wa.me/" + WA; });
    document.querySelectorAll("[data-wa-text]").forEach(function (el) { el.textContent = CFG.WHATSAPP_TEXTO; });
    document.querySelectorAll("[data-wa-title]").forEach(function (el) { el.title = "WhatsApp " + CFG.WHATSAPP_TEXTO; });
  }
  function init() {
    applyConfig();
    bind();
    products = Array.isArray(window.__PRODUCTOS__) ? window.__PRODUCTOS__ : [];
    if (!products.length) { countEl.textContent = "No se pudieron cargar los productos"; return; }
    products.forEach(function (p) { byId[p.id] = p; });
    Object.keys(cart).forEach(function (id) { if (!byId[id]) delete cart[id]; });
    var counts = {};
    products.forEach(function (p) { counts[p.marca] = (counts[p.marca] || 0) + 1; });
    brands = Object.keys(counts).sort(function (a, b) { return a.localeCompare(b, "es"); });
    renderChips(); renderGrid(); updateCartBar();
    if (location.hash === "#catalogo") { cover.classList.add("hidden"); app.classList.add("is-visible"); updateCartBar(); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !isNative()) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("./service-worker.js").catch(function () {}); });
  }
})();
