const API = "/api/admin";

// O painel roda num servidor/porta separado do site público (de propósito,
// para ficar fora do alcance de quem só navega a loja). Em produção, troque
// pelo domínio público real depois do deploy.
const PUBLIC_SITE_URL = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? `${location.protocol}//${location.hostname}:8934`
  : "https://enxoval-da-mari.vercel.app";

let categoriasCache = [];
let productsCache = [];
let galleryImages = [];
let editingId = null;

function el(id) {
  return document.getElementById(id);
}

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro inesperado.");
  return data;
}

function showView(authenticated) {
  el("loginView").hidden = authenticated;
  el("dashboardView").hidden = !authenticated;
}

async function checkSession() {
  try {
    const { authenticated } = await api("/me");
    showView(authenticated);
    if (authenticated) {
      loadCategorias();
      loadProducts();
    }
  } catch {
    showView(false);
  }
}

function setupLogin() {
  el("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = el("loginError");
    errorEl.hidden = true;
    try {
      await api("/login", {
        method: "POST",
        body: JSON.stringify({ password: el("password").value }),
      });
      el("password").value = "";
      showView(true);
      loadCategorias();
      loadProducts();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    }
  });
}

function setupLogout() {
  el("logoutBtn").addEventListener("click", async () => {
    await api("/logout", { method: "POST" });
    showView(false);
  });
}

async function loadCategorias() {
  categoriasCache = await api("/categorias");
  const select = el("category");
  select.innerHTML = "";
  categoriasCache.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat.slug;
    opt.textContent = `${cat.icon} ${cat.label}`;
    select.appendChild(opt);
  });
  const newOpt = document.createElement("option");
  newOpt.value = "__nova__";
  newOpt.textContent = "+ Nova categoria";
  select.appendChild(newOpt);
}

function setupCategorySelect() {
  el("category").addEventListener("change", (e) => {
    el("newCategoryFields").hidden = e.target.value !== "__nova__";
  });
}

async function loadProducts() {
  productsCache = await api("/products");
  renderProductList();
}

function renderProductList() {
  const container = el("productList");
  if (!productsCache.length) {
    container.innerHTML = `<p class="catalog-status">Nenhum produto cadastrado ainda.</p>`;
    return;
  }

  container.innerHTML = "";
  productsCache
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.addedAt) - new Date(a.updatedAt || a.addedAt))
    .forEach((product) => {
      const categoria = categoriasCache.find((c) => c.slug === product.category);
      const row = document.createElement("article");
      row.className = "admin-row";
      row.innerHTML = `
        <img class="admin-row__image" src="${product.image || ""}" alt="" />
        <div class="admin-row__info">
          <strong>${escapeHtml(product.title)}</strong>
          <span>${categoria ? categoria.icon + " " + categoria.label : product.category} ${product.price ? "· " + escapeHtml(product.price) : ""}</span>
        </div>
        <div class="admin-row__actions">
          <button type="button" class="btn btn--ghost btn--small" data-action="edit">Editar</button>
          <button type="button" class="btn btn--ghost btn--small" data-action="delete">Excluir</button>
        </div>
      `;
      row.querySelector('[data-action="edit"]').addEventListener("click", () => editProduct(product));
      row.querySelector('[data-action="delete"]').addEventListener("click", () => removeProduct(product));
      container.appendChild(row);
    });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function renderGallery() {
  const gallery = el("gallery");
  gallery.innerHTML = "";
  galleryImages.forEach((src, index) => {
    const thumb = document.createElement("div");
    thumb.className = "admin-thumb" + (index === 0 ? " is-primary" : "");
    thumb.innerHTML = `
      <img src="${src}" alt="" />
      <button type="button" class="admin-thumb__remove" title="Remover">×</button>
      ${index !== 0 ? '<button type="button" class="admin-thumb__pick" title="Usar como principal">Tornar principal</button>' : '<span class="admin-thumb__badge">Principal</span>'}
    `;
    thumb.querySelector(".admin-thumb__remove").addEventListener("click", () => {
      galleryImages.splice(index, 1);
      renderGallery();
    });
    const pickBtn = thumb.querySelector(".admin-thumb__pick");
    if (pickBtn) {
      pickBtn.addEventListener("click", () => {
        const [chosen] = galleryImages.splice(index, 1);
        galleryImages.unshift(chosen);
        renderGallery();
      });
    }
    gallery.appendChild(thumb);
  });
}

function setupAddImage() {
  el("addImageBtn").addEventListener("click", () => {
    const input = el("newImageUrl");
    const value = input.value.trim();
    if (!value) return;
    galleryImages.push(value);
    input.value = "";
    renderGallery();
  });
}

function updateVideoPreview() {
  const url = el("video").value.trim();
  const preview = el("videoPreview");
  preview.innerHTML = "";
  if (!url) return;

  if (isYoutubeUrl(url)) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "▶ Abrir vídeo do YouTube em nova aba";
    preview.appendChild(link);
  } else {
    const video = document.createElement("video");
    video.controls = true;
    preview.appendChild(video);
    attachVideoSource(video, url);
  }
}

function setupVideoPreview() {
  el("video").addEventListener("input", updateVideoPreview);
}

function resetForm() {
  editingId = null;
  galleryImages = [];
  el("productForm").reset();
  el("productForm").hidden = true;
  el("gallery").innerHTML = "";
  el("videoPreview").innerHTML = "";
  el("newCategoryFields").hidden = true;
  el("formTitle").textContent = "Adicionar produto";
  el("saveBtn").textContent = "Salvar produto";
  el("cancelEditBtn").hidden = true;
  el("amazonUrl").value = "";
  el("fetchStatus").textContent = "";
}

function fillForm(data) {
  el("productForm").hidden = false;
  el("title").value = data.title || "";
  el("price").value = data.price || "";
  el("description").value = data.description || "";
  el("bullets").value = (data.bullets || []).join("\n");
  el("video").value = data.video || "";
  el("url").value = data.url || "";
  galleryImages = data.images && data.images.length ? [...data.images] : data.image ? [data.image] : [];
  renderGallery();
  updateVideoPreview();
  if (data.category) el("category").value = data.category;
}

function setupFetch() {
  el("fetchBtn").addEventListener("click", async () => {
    const url = el("amazonUrl").value.trim();
    const status = el("fetchStatus");
    if (!url) {
      status.textContent = "Cole o link do produto primeiro.";
      return;
    }
    status.textContent = "Buscando dados na Amazon...";
    try {
      const data = await api("/scrape", { method: "POST", body: JSON.stringify({ url }) });
      fillForm(data);
      status.textContent = data.blocked
        ? "Não foi possível acessar a página automaticamente. Preencha os campos manualmente abaixo."
        : "Dados encontrados. Revise antes de salvar.";
    } catch (err) {
      status.textContent = err.message;
    }
  });
}

function editProduct(product) {
  editingId = product.id;
  fillForm(product);
  el("formTitle").textContent = "Editar produto";
  el("saveBtn").textContent = "Atualizar produto";
  el("cancelEditBtn").hidden = false;
  el("amazonUrl").value = product.url || "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function removeProduct(product) {
  if (!confirm(`Excluir "${product.title}"?`)) return;
  await api(`/products/${product.id}`, { method: "DELETE" });
  loadProducts();
}

function setupCancelEdit() {
  el("cancelEditBtn").addEventListener("click", resetForm);
}

async function ensureCategory() {
  const select = el("category");
  if (select.value !== "__nova__") return select.value;

  const slug = el("newCategorySlug").value.trim();
  const label = el("newCategoryLabel").value.trim();
  const icon = el("newCategoryIcon").value.trim();
  if (!slug) throw new Error("Informe o slug da nova categoria.");

  await api("/categorias", { method: "POST", body: JSON.stringify({ slug, label, icon }) });
  await loadCategorias();
  select.value = slug;
  el("newCategoryFields").hidden = true;
  return slug;
}

function setupForm() {
  el("productForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = el("formError");
    errorEl.hidden = true;

    try {
      const category = await ensureCategory();
      const payload = {
        id: editingId || undefined,
        title: el("title").value.trim(),
        price: el("price").value.trim() || null,
        description: el("description").value.trim() || null,
        bullets: el("bullets").value.split("\n").map((s) => s.trim()).filter(Boolean),
        video: el("video").value.trim() || null,
        url: el("url").value.trim(),
        images: galleryImages,
        image: galleryImages[0] || null,
        category,
      };

      if (editingId) {
        await api(`/products/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api("/products", { method: "POST", body: JSON.stringify(payload) });
      }

      resetForm();
      loadProducts();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    }
  });
}

function setupViewSiteLink() {
  el("viewSiteLink").href = PUBLIC_SITE_URL;
}

document.addEventListener("DOMContentLoaded", () => {
  setupViewSiteLink();
  setupLogin();
  setupLogout();
  setupCategorySelect();
  setupAddImage();
  setupVideoPreview();
  setupFetch();
  setupForm();
  setupCancelEdit();
  checkSession();
});
