const DB_NAME = "mr-celulares-db";
const DB_VERSION = 1;
const PRODUCT_STORE = "products";
const RECEIPT_STORE = "receipts";
// Enter the store number with country code only, for example 54911XXXXXXXX.
const WHATSAPP_PHONE = "";
const INSTAGRAM_URL = "";
const TIKTOK_URL = "";
// Optional first-load catalog: name, brand, condition, price, currency, battery, grade, description, photoUrl.
const INITIAL_PRODUCTS = [];

const elements = {
  addButton: document.querySelector("#add-product-button"),
  emptyAddButton: document.querySelector("#empty-add-button"),
  productDialog: document.querySelector("#product-dialog"),
  productForm: document.querySelector("#product-form"),
  productTitle: document.querySelector("#product-dialog-title"),
  productId: document.querySelector("#product-id"),
  productName: document.querySelector("#product-name"),
  productCondition: document.querySelector("#product-condition"),
  productPrice: document.querySelector("#product-price"),
  productDescription: document.querySelector("#product-description"),
  productBrand: document.querySelector("#product-brand"),
  productCurrency: document.querySelector("#product-currency"),
  productBattery: document.querySelector("#product-battery"),
  productGrade: document.querySelector("#product-grade"),
  productPhoto: document.querySelector("#product-photo"),
  photoFileName: document.querySelector("#photo-file-name"),
  photoPreview: document.querySelector("#photo-preview"),
  productError: document.querySelector("#product-error"),
  saleDialog: document.querySelector("#sale-dialog"),
  saleForm: document.querySelector("#sale-form"),
  saleProductId: document.querySelector("#sale-product-id"),
  saleProductSummary: document.querySelector("#sale-product-summary"),
  salePrice: document.querySelector("#sale-price"),
  saleError: document.querySelector("#sale-error"),
  receiptDialog: document.querySelector("#receipt-dialog"),
  printReceipt: document.querySelector("#print-receipt"),
  printButton: document.querySelector("#print-button"),
  productGrid: document.querySelector("#product-grid"),
  inventoryEmpty: document.querySelector("#inventory-empty"),
  inventoryEmptyTitle: document.querySelector("#inventory-empty-title"),
  inventoryEmptyCopy: document.querySelector("#inventory-empty-copy"),
  receiptList: document.querySelector("#receipt-list"),
  receiptsEmpty: document.querySelector("#receipts-empty"),
  stockCount: document.querySelector("#stock-count"),
  soldCount: document.querySelector("#sold-count"),
  receiptCount: document.querySelector("#receipt-count"),
  tabReceiptCount: document.querySelector("#tab-receipt-count"),
  search: document.querySelector("#search-input"),
  statusFilter: document.querySelector("#status-filter"),
  inventoryTab: document.querySelector("#inventory-tab"),
  receiptsTab: document.querySelector("#receipts-tab"),
  inventoryView: document.querySelector("#inventory-view"),
  receiptsView: document.querySelector("#receipts-view"),
  toast: document.querySelector("#toast")
};

let database;
let products = [];
let receipts = [];
let pendingPhoto = null;
let toastTimer;
let catalogFilter = "all";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PRODUCT_STORE)) db.createObjectStore(PRODUCT_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(RECEIPT_STORE)) db.createObjectStore(RECEIPT_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir la base de datos."));
    request.onblocked = () => reject(new Error("Cierra otras pestañas de esta página y vuelve a intentarlo."));
  });
}

function getAll(storeName) {
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudieron leer los datos."));
  });
}

function saveProduct(product) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PRODUCT_STORE, "readwrite");
    transaction.objectStore(PRODUCT_STORE).put(product);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error("No se pudo guardar el celular."));
    transaction.onabort = () => reject(transaction.error || new Error("No se pudo guardar el celular."));
  });
}

function saveSale(product, receipt) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([PRODUCT_STORE, RECEIPT_STORE], "readwrite");
    transaction.objectStore(PRODUCT_STORE).put({ ...product, status: "sold", soldAt: receipt.soldAt });
    transaction.objectStore(RECEIPT_STORE).add(receipt);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error("No se pudo registrar la venta."));
    transaction.onabort = () => reject(transaction.error || new Error("No se pudo registrar la venta."));
  });
}

function formatPrice(value, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "ARS" ? 0 : 2
  }).format(Number(value));
}

function formatPriceInput(value) {
  if (value === "" || value === null || value === undefined) return "";
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(Number(value));
}

function parsePrice(value) {
  let normalized = value.trim().replace(/[^\d.,+-]/g, "");
  if (!normalized || !/\d/.test(normalized)) return NaN;

  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const groupingSeparator = decimalSeparator === "," ? "." : ",";
    normalized = normalized.split(groupingSeparator).join("");
    if (decimalSeparator === ",") normalized = normalized.replace(",", ".");
    else normalized = normalized.replace(",", "");
  } else {
    const separator = lastComma !== -1 ? "," : lastDot !== -1 ? "." : "";
    if (separator) {
      const parts = normalized.split(separator);
      const trailingDigits = parts[parts.length - 1].length;
      const isThousandsGrouping = parts.length > 1
        && parts.slice(1).every(part => part.length === 3)
        && parts[0].length > 0
        && parts[0].length <= 3;
      if (isThousandsGrouping || trailingDigits === 3) {
        normalized = parts.join("");
      } else {
        normalized = `${parts.slice(0, -1).join("")}.${parts[parts.length - 1]}`;
      }
    }
  }

  const price = Number(normalized);
  return Number.isFinite(price) && price > 0 ? price : NaN;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function notify(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 3200);
}

function showError(element, message) {
  element.textContent = message;
  element.hidden = false;
}

function hideError(element) {
  element.textContent = "";
  element.hidden = true;
}

async function refreshData() {
  [products, receipts] = await Promise.all([
    getAll(PRODUCT_STORE),
    getAll(RECEIPT_STORE)
  ]);
  products.sort((a, b) => b.createdAt - a.createdAt);
  receipts.sort((a, b) => b.soldAt - a.soldAt);
  render();
}

function render() {
  const availableCount = products.filter(product => product.status !== "sold").length;
  elements.stockCount.textContent = availableCount;
  elements.soldCount.textContent = products.length - availableCount;
  elements.receiptCount.textContent = receipts.length;
  elements.tabReceiptCount.textContent = receipts.length;
  renderProducts();
  renderReceipts();
}

function renderProducts() {
  const query = elements.search.value.trim().toLocaleLowerCase("es");
  const status = elements.statusFilter.value;
  const visibleProducts = products.filter(product => {
    const searchable = `${product.name} ${product.brand || ""} ${product.description || ""}`.toLocaleLowerCase("es");
    const matchesText = searchable.includes(query);
    const isAvailable = product.status !== "sold";
    const matchesStatus = status === "all" || (status === "available" ? isAvailable : product.status === status);
    const brand = detectBrand(product);
    const matchesCategory = catalogFilter === "all"
      || (catalogFilter === "sealed" && product.condition === "sealed")
      || (catalogFilter === "used" && product.condition !== "sealed")
      || (catalogFilter === "apple" && brand === "apple")
      || (catalogFilter === "samsung" && brand === "samsung")
      || (catalogFilter === "xiaomi-motorola" && ["xiaomi", "motorola"].includes(brand));
    return matchesText && matchesStatus && matchesCategory;
  });

  elements.productGrid.replaceChildren();
  visibleProducts.forEach(product => elements.productGrid.append(createProductCard(product)));
  document.querySelector("#catalog-count").textContent = `${visibleProducts.length} ${visibleProducts.length === 1 ? "equipo disponible" : "equipos disponibles"}`;
  const noProductsExist = products.filter(product => product.status !== "sold").length === 0;
  elements.inventoryEmpty.hidden = visibleProducts.length > 0;
  elements.inventoryEmptyTitle.textContent = noProductsExist ? "Próximamente, nuevos equipos." : "No encontramos equipos con ese filtro.";
  elements.inventoryEmptyCopy.textContent = noProductsExist
    ? "Estamos preparando el catálogo. Escribinos y te ayudamos a encontrar el tuyo."
    : "Probá con otra búsqueda o consultanos por WhatsApp para encontrar tu próximo celular.";
  elements.emptyAddButton.hidden = true;
}

function detectBrand(product) {
  const value = `${product.brand || ""} ${product.name || ""}`.toLocaleLowerCase("es");
  if (value.includes("apple") || value.includes("iphone")) return "apple";
  if (value.includes("samsung") || /\bgalaxy\b/.test(value)) return "samsung";
  if (value.includes("xiaomi") || value.includes("redmi") || value.includes("poco")) return "xiaomi";
  if (value.includes("motorola") || /\bmoto\b/.test(value)) return "motorola";
  return "other";
}

function createProductCard(product) {
  const card = document.createElement("article");
  card.className = "product-card";
  const isSold = product.status === "sold";
  const isSealed = product.condition === "sealed";
  const condition = isSealed ? "NUEVO SELLADO" : "USADO SELECCIONADO";
  const photoObjectUrl = product.photo instanceof Blob ? URL.createObjectURL(product.photo) : null;
  const photoUrl = photoObjectUrl || product.photoUrl || "";
  const photo = photoUrl
    ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(product.name)}">`
    : `<div class="product-placeholder ${detectBrand(product)}" aria-hidden="true"><span class="placeholder-glow"></span><span class="placeholder-phone">MR</span><span class="placeholder-brand">${escapeHtml(product.brand || brandLabel(detectBrand(product)))}</span></div>`;
  const usedDetails = !isSealed && (product.battery || product.grade)
    ? `<div class="product-condition-details">${product.battery ? `<span class="battery-tag">⌁ Batería ${escapeHtml(product.battery)}%</span>` : ""}${product.grade ? `<span class="grade-tag">${escapeHtml(product.grade)}</span>` : ""}</div>`
    : "";
  card.innerHTML = `
    <div class="product-image">
      ${photo}
      <span class="condition-badge ${isSealed ? "sealed" : "used"}">${condition}</span>
      ${isSold ? '<span class="sold-overlay">VENDIDO</span>' : ""}
    </div>
    <div class="product-content">
      <h3>${escapeHtml(product.name)}</h3>
      <p class="product-description">${escapeHtml(product.description || (isSold ? `Vendido ${formatDate(product.soldAt)}` : brandLabel(detectBrand(product))))}</p>
      ${usedDetails}
      <p class="product-price">${formatPrice(product.price, product.currency)}<span>${product.currency === "USD" ? "USD" : "ARS"}</span></p>
      <p class="product-price-note">${product.priceNote ? escapeHtml(product.priceNote) : "Precio contado · Consultá financiación"}</p>
      <a class="button button-whatsapp product-contact whatsapp-link ${isSold ? "is-sold" : ""}" href="#" data-message="Hola, quiero consultar por el ${escapeHtml(product.name)}. ¿Sigue disponible?">Consultar este equipo <span aria-hidden="true">↗</span></a>
      <div class="product-owner-actions">
        ${isSold
          ? '<button class="small-button restore-button" data-action="restore">Volver a stock</button>'
          : '<button class="small-button" data-action="edit">Editar</button><button class="small-button sell-button" data-action="sell">Registrar venta</button>'}
      </div>
    </div>`;
  card.querySelectorAll("[data-action]").forEach(button => {
    button.addEventListener("click", event => {
      const action = event.currentTarget.dataset.action;
      if (action === "edit") openProductDialog(product);
      if (action === "sell") openSaleDialog(product);
      if (action === "restore") restoreProduct(product);
      if (action === "sell") document.querySelector("#management-panel").open = true;
    });
  });
  const image = card.querySelector(".product-image img");
  if (photoObjectUrl) image?.addEventListener("load", () => URL.revokeObjectURL(photoObjectUrl), { once: true });
  card.querySelectorAll(".whatsapp-link").forEach(link => attachWhatsApp(link));
  return card;
}

function brandLabel(brand) {
  return ({ apple: "Apple", samsung: "Samsung", xiaomi: "Xiaomi", motorola: "Motorola", other: "Smartphone" })[brand] || "Smartphone";
}

function renderReceipts() {
  elements.receiptList.replaceChildren();
  receipts.forEach(receipt => {
    const row = document.createElement("article");
    row.className = "receipt-row";
    row.innerHTML = `
      <div class="receipt-main"><strong>${escapeHtml(receipt.productName)}</strong><span>${escapeHtml(receipt.number)} · ${formatDate(receipt.soldAt)}</span></div>
      <div class="receipt-detail"><strong>${escapeHtml(receipt.buyer.name)}</strong><span>Comprador</span></div>
      <div class="receipt-amount">${formatPrice(receipt.salePrice, receipt.currency)}</div>
      <button class="small-button" type="button">Ver comprobante</button>`;
    row.querySelector("button").addEventListener("click", () => openReceipt(receipt));
    elements.receiptList.append(row);
  });
  elements.receiptsEmpty.hidden = receipts.length > 0;
}

function openProductDialog(product = null) {
  elements.productForm.reset();
  hideError(elements.productError);
  pendingPhoto = null;
  elements.productId.value = product?.id || "";
  elements.productTitle.textContent = product ? "Editar celular" : "Agregar celular";
  elements.productName.value = product?.name || "";
  elements.productCondition.value = product?.condition || "used";
  elements.productPrice.value = formatPriceInput(product?.price);
  elements.productDescription.value = product?.description || "";
  elements.productBrand.value = product?.brand || "";
  elements.productCurrency.value = product?.currency || "ARS";
  elements.productBattery.value = product?.battery || "";
  elements.productGrade.value = product?.grade || "";
  elements.photoFileName.textContent = product?.photo ? "Foto guardada · elegir otra para reemplazarla" : "Elegir una foto del celular";
  elements.photoPreview.hidden = !product?.photo;
  if (elements.photoPreview.src.startsWith("blob:")) URL.revokeObjectURL(elements.photoPreview.src);
  elements.photoPreview.src = product?.photo ? URL.createObjectURL(product.photo) : "";
  if (product?.photo) elements.photoPreview.onload = () => URL.revokeObjectURL(elements.photoPreview.src);
  elements.productDialog.showModal();
  elements.productName.focus();
}

function openSaleDialog(product) {
  elements.saleForm.reset();
  hideError(elements.saleError);
  elements.saleProductId.value = product.id;
  elements.salePrice.value = formatPriceInput(product.price);
  elements.saleProductSummary.textContent = `${product.name} · ${formatPrice(product.price, product.currency)}`;
  elements.saleDialog.showModal();
  document.querySelector("#management-panel").open = true;
  document.querySelector("#buyer-name").focus();
}

function createReceiptNumber(date) {
  const datePart = new Intl.DateTimeFormat("en-CA").format(date).replaceAll("-", "");
  const randomPart = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().slice(0, 5);
  return `MR-${datePart}-${randomPart}`;
}

async function restoreProduct(product) {
  try {
    const { soldAt, ...availableProduct } = product;
    availableProduct.status = "available";
    await saveProduct(availableProduct);
    await refreshData();
    notify("El celular volvió al inventario. El comprobante anterior se conservó.");
  } catch (error) {
    notify(`No se pudo actualizar el inventario: ${error.message}`);
  }
}

function receiptLine(label, value) {
  return `<div class="receipt-line"><span>${label}</span><strong>${value ? escapeHtml(value) : "—"}</strong></div>`;
}

function openReceipt(receipt) {
  elements.printReceipt.innerHTML = `
    <div class="receipt-brand"><strong>MR celulares</strong><p>Comprobante de venta</p></div>
    <div class="receipt-number"><span>N.º <strong>${escapeHtml(receipt.number)}</strong></span><span>${formatDate(receipt.soldAt)}</span></div>
    <p class="eyebrow">DATOS DEL COMPRADOR</p>
    ${receiptLine("Nombre y apellido", receipt.buyer.name)}
    ${receiptLine("DNI / documento", receipt.buyer.document)}
    ${receiptLine("Teléfono", receipt.buyer.phone)}
    ${receiptLine("Correo electrónico", receipt.buyer.email)}
    ${receiptLine("Domicilio", receipt.buyer.address)}
    <p class="eyebrow" style="margin-top:20px">DETALLE DE LA VENTA</p>
    ${receiptLine("Celular", receipt.productName)}
    ${receiptLine("Estado", receipt.condition === "sealed" ? "Nuevo sellado" : "Usado")}
    ${receiptLine("Forma de pago", receipt.payment)}
    <div class="receipt-total"><span>Total</span><span>${formatPrice(receipt.salePrice, receipt.currency)}</span></div>
    <p class="receipt-thanks">Conserve este comprobante como constancia de la operación.</p>`;
  elements.receiptDialog.showModal();
}

elements.addButton.addEventListener("click", () => openProductDialog());
elements.emptyAddButton.addEventListener("click", () => openProductDialog());
elements.productPhoto.addEventListener("change", () => {
  const file = elements.productPhoto.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showError(elements.productError, "El archivo seleccionado no es una imagen.");
    elements.productPhoto.value = "";
    return;
  }
  pendingPhoto = file;
  elements.photoFileName.textContent = file.name;
  if (elements.photoPreview.src.startsWith("blob:")) URL.revokeObjectURL(elements.photoPreview.src);
  elements.photoPreview.src = URL.createObjectURL(file);
  elements.photoPreview.onload = () => URL.revokeObjectURL(elements.photoPreview.src);
  elements.photoPreview.hidden = false;
  hideError(elements.productError);
});

elements.productForm.addEventListener("submit", async event => {
  event.preventDefault();
  hideError(elements.productError);
  if (!elements.productForm.reportValidity()) return;
  const price = parsePrice(elements.productPrice.value);
  if (!Number.isFinite(price)) {
    showError(elements.productError, "Ingresá un precio válido. Por ejemplo: 800.000 para ochocientos mil pesos.");
    return;
  }
  const existing = products.find(product => product.id === elements.productId.value);
  const battery = elements.productBattery.value ? Number(elements.productBattery.value) : null;
  const product = {
    id: existing?.id || crypto.randomUUID(),
    name: elements.productName.value.trim(),
    condition: elements.productCondition.value,
    price,
    currency: elements.productCurrency.value,
    brand: elements.productBrand.value,
    battery,
    grade: elements.productGrade.value,
    description: elements.productDescription.value.trim(),
    photo: pendingPhoto || existing?.photo || null,
    photoUrl: existing?.photoUrl || "",
    status: existing?.status || "available",
    createdAt: existing?.createdAt || Date.now()
  };
  try {
    await saveProduct(product);
    await refreshData();
    elements.productDialog.close();
    notify(existing ? "Celular actualizado." : "Celular agregado al inventario.");
  } catch (error) {
    showError(elements.productError, `No se pudo guardar: ${error.message}`);
  }
});

elements.saleForm.addEventListener("submit", async event => {
  event.preventDefault();
  hideError(elements.saleError);
  if (!elements.saleForm.reportValidity()) return;
  const product = products.find(item => item.id === elements.saleProductId.value);
  if (!product || product.status === "sold") {
    showError(elements.saleError, "Este celular ya no está disponible. Actualiza el inventario e inténtalo de nuevo.");
    return;
  }
  const salePrice = parsePrice(elements.salePrice.value);
  if (!Number.isFinite(salePrice)) {
    showError(elements.saleError, "Ingresá un precio de venta válido. Por ejemplo: 800.000 para ochocientos mil pesos.");
    return;
  }
  const soldAt = Date.now();
  const receipt = {
    id: crypto.randomUUID(),
    number: createReceiptNumber(new Date(soldAt)),
    soldAt,
    productId: product.id,
    productName: product.name,
    condition: product.condition,
    salePrice,
    currency: product.currency || "ARS",
    payment: elements.saleForm.elements.payment.value,
    buyer: {
      name: elements.saleForm.elements.buyerName.value.trim(),
      document: elements.saleForm.elements.buyerDocument.value.trim(),
      phone: elements.saleForm.elements.buyerPhone.value.trim(),
      email: elements.saleForm.elements.buyerEmail.value.trim(),
      address: elements.saleForm.elements.buyerAddress.value.trim()
    }
  };
  try {
    await saveSale(product, receipt);
    await refreshData();
    elements.saleDialog.close();
    openReceipt(receipt);
    notify("Venta registrada y comprobante guardado.");
  } catch (error) {
    showError(elements.saleError, `No se pudo registrar la venta: ${error.message}`);
  }
});

elements.printButton.addEventListener("click", () => window.print());
elements.search.addEventListener("input", renderProducts);
elements.statusFilter.addEventListener("change", renderProducts);
document.querySelectorAll("[data-catalog-filter]").forEach(button => {
  button.addEventListener("click", () => {
    catalogFilter = button.dataset.catalogFilter;
    document.querySelectorAll("[data-catalog-filter]").forEach(filterButton => {
      const active = filterButton === button;
      filterButton.classList.toggle("active", active);
      filterButton.setAttribute("aria-pressed", String(active));
    });
    renderProducts();
  });
});
document.querySelectorAll("[data-filter-link]").forEach(link => {
  link.addEventListener("click", () => {
    catalogFilter = link.dataset.filterLink;
    document.querySelectorAll("[data-catalog-filter]").forEach(button => {
      const active = button.dataset.catalogFilter === catalogFilter;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    renderProducts();
  });
});
document.querySelector("#management-panel").addEventListener("toggle", event => {
  document.body.classList.toggle("management-open", event.currentTarget.open);
  renderProducts();
});

function whatsappUrl(message) {
  const encodedMessage = encodeURIComponent(message);
  const phone = WHATSAPP_PHONE.replace(/\D/g, "");
  return `https://wa.me/${phone}?text=${encodedMessage}`;
}

function attachWhatsApp(link) {
  link.href = whatsappUrl(link.dataset.message || "Hola, quiero consultar por MR Celulares.");
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.addEventListener("click", event => {
    if (!WHATSAPP_PHONE) {
      event.preventDefault();
      notify("Configurá el número de WhatsApp de la tienda en app.js para recibir consultas directas.");
    }
  });
}

document.querySelectorAll(".whatsapp-link").forEach(attachWhatsApp);
[
  [".instagram-link", INSTAGRAM_URL],
  [".tiktok-link", TIKTOK_URL]
].forEach(([selector, url]) => {
  document.querySelectorAll(selector).forEach(link => {
    link.href = url || "#";
    if (url) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    } else {
      link.addEventListener("click", event => {
        event.preventDefault();
        notify(`Agregá el enlace de ${link.dataset.social} en app.js para conectar el perfil.`);
      });
    }
  });
});
document.querySelector("#trade-form").addEventListener("submit", event => {
  event.preventDefault();
  const brand = document.querySelector("#trade-brand").value;
  const model = document.querySelector("#trade-model").value.trim();
  if (!brand || !model) {
    event.currentTarget.reportValidity();
    return;
  }
  const battery = document.querySelector("#trade-battery").value;
  const condition = document.querySelector("#trade-condition").value;
  const message = `Hola, quiero cotizar mi celular para Plan Canje.
Marca: ${brand}
Modelo y capacidad: ${model}
Batería: ${battery}
Estado estético: ${condition}`;
  const link = document.createElement("a");
  link.href = whatsappUrl(message);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  if (!WHATSAPP_PHONE) {
    notify("Configurá el número de WhatsApp de la tienda en app.js para recibir cotizaciones.");
    return;
  }
  link.click();
});
document.querySelector("#current-year").textContent = new Date().getFullYear();
document.querySelector("#menu-toggle").addEventListener("click", event => {
  const isOpen = document.querySelector(".site-nav").classList.toggle("is-open");
  event.currentTarget.setAttribute("aria-expanded", String(isOpen));
  event.currentTarget.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
});
document.querySelectorAll(".site-nav a").forEach(link => link.addEventListener("click", () => {
  document.querySelector(".site-nav").classList.remove("is-open");
  document.querySelector("#menu-toggle").setAttribute("aria-expanded", "false");
}));

const heroSection = document.querySelector(".hero");
const heroArtwork = document.querySelector(".hero-art");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
let heroTargetX = 0;
let heroTargetY = 0;
let heroCurrentX = 0;
let heroCurrentY = 0;
let heroFrame = 0;

function animateHeroParallax() {
  heroCurrentX += (heroTargetX - heroCurrentX) * 0.075;
  heroCurrentY += (heroTargetY - heroCurrentY) * 0.075;
  heroArtwork.style.setProperty("--pointer-rotate-x", `${-heroCurrentY * 7}deg`);
  heroArtwork.style.setProperty("--pointer-rotate-y", `${heroCurrentX * 9}deg`);
  if (Math.abs(heroTargetX - heroCurrentX) > 0.001 || Math.abs(heroTargetY - heroCurrentY) > 0.001) {
    heroFrame = window.requestAnimationFrame(animateHeroParallax);
  } else {
    heroFrame = 0;
  }
}

function resetHeroParallax() {
  heroTargetX = 0;
  heroTargetY = 0;
  if (!heroFrame) heroFrame = window.requestAnimationFrame(animateHeroParallax);
}

if (!reduceMotion.matches && finePointer.matches) {
  heroSection.addEventListener("pointermove", event => {
    if (event.pointerType === "touch") return;
    const bounds = heroSection.getBoundingClientRect();
    heroTargetX = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2));
    heroTargetY = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2));
    const artworkBounds = heroArtwork.getBoundingClientRect();
    const lightX = Math.max(0, Math.min(100, ((event.clientX - artworkBounds.left) / artworkBounds.width) * 100));
    const lightY = Math.max(0, Math.min(100, ((event.clientY - artworkBounds.top) / artworkBounds.height) * 100));
    heroArtwork.style.setProperty("--light-x", `${lightX}%`);
    heroArtwork.style.setProperty("--light-y", `${lightY}%`);
    if (!heroFrame) heroFrame = window.requestAnimationFrame(animateHeroParallax);
  });
  heroSection.addEventListener("pointerleave", () => {
    heroArtwork.style.setProperty("--light-x", "50%");
    heroArtwork.style.setProperty("--light-y", "45%");
    resetHeroParallax();
  });
}

reduceMotion.addEventListener("change", event => {
  if (event.matches) {
    window.cancelAnimationFrame(heroFrame);
    heroFrame = 0;
    heroTargetX = 0;
    heroTargetY = 0;
    heroCurrentX = 0;
    heroCurrentY = 0;
    heroArtwork.style.removeProperty("--pointer-rotate-x");
    heroArtwork.style.removeProperty("--pointer-rotate-y");
  }
});

function showView(view) {
  const showInventory = view === "inventory";
  elements.inventoryView.hidden = !showInventory;
  elements.receiptsView.hidden = showInventory;
  elements.inventoryTab.classList.toggle("active", showInventory);
  elements.receiptsTab.classList.toggle("active", !showInventory);
  elements.inventoryTab.setAttribute("aria-selected", String(showInventory));
  elements.receiptsTab.setAttribute("aria-selected", String(!showInventory));
}

elements.inventoryTab.addEventListener("click", () => showView("inventory"));
elements.receiptsTab.addEventListener("click", () => showView("receipts"));
document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => document.getElementById(button.dataset.close).close());
});
document.querySelectorAll(".dialog").forEach(dialog => {
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
});

openDatabase()
  .then(async db => {
    database = db;
    if ((await getAll(PRODUCT_STORE)).length === 0 && INITIAL_PRODUCTS.length > 0) {
      for (const product of INITIAL_PRODUCTS) {
        await saveProduct({
          ...product,
          id: product.id || crypto.randomUUID(),
          status: product.status || "available",
          createdAt: product.createdAt || Date.now()
        });
      }
    }
    return refreshData();
  })
  .catch(error => {
    document.querySelector("main").innerHTML = `
      <section class="empty-state">
        <h2>No se pudo iniciar la página</h2>
        <p>${escapeHtml(error.message)} Prueba a abrirla en un navegador actualizado y vuelve a cargar.</p>
      </section>`;
  });
