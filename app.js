// Configuración de la API del Art Institute of Chicago
const API_BASE_URL = "https://api.artic.edu/api/v1/artworks/search";
const IIIF_DEFAULT_BASE = "https://www.artic.edu/iiif/2";

// Estado de la aplicación
let currentPage = 1;
let currentQuery = "Monet";
let iiifBaseUrl = IIIF_DEFAULT_BASE;
let currentArtworks = [];
let favorites = JSON.parse(localStorage.getItem("museo_favoritos")) || [];

// Elementos del DOM
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const publicDomainFilter = document.getElementById("public-domain-filter");
const validationMsg = document.getElementById("validation-msg");
const statusMessage = document.getElementById("status-message");
const galleryGrid = document.getElementById("gallery-grid");
const favoritesGrid = document.getElementById("favorites-grid");
const btnPrev = document.getElementById("btn-prev");
const btnNext = document.getElementById("btn-next");
const pageInfo = document.getElementById("page-info");
const detailModal = document.getElementById("detail-modal");
const detailBody = document.getElementById("detail-body");
const btnCloseModal = document.getElementById("btn-close-modal");

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
  fetchArtworks();
  renderFavorites();

  // Event Listeners
  searchForm.addEventListener("submit", handleSearch);
  publicDomainFilter.addEventListener("change", () => {
    currentPage = 1;
    fetchArtworks();
  });
  btnPrev.addEventListener("click", () => changePage(-1));
  btnNext.addEventListener("click", () => changePage(1));
  btnCloseModal.addEventListener("click", closeModal);
  detailModal.addEventListener("click", (e) => {
    if (e.target === detailModal) closeModal();
  });
});

// Petición a la API de Chicago
async function fetchArtworks() {
  const query = searchInput.value.trim();
  if (!query) {
    showValidation("Por favor, ingresa un término de búsqueda.");
    return;
  }
  hideValidation();
  showStatus("Cargando obras maestras...");

  // Campos específicos requeridos
  const fields = "id,title,artist_title,image_id,is_public_domain,date_display,medium_display";
  let url = `${API_BASE_URL}?q=${encodeURIComponent(query)}&page=${currentPage}&limit=12&fields=${fields}`;

  if (publicDomainFilter.checked) {
    url += "&query[term][is_public_domain]=true";
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Error en la respuesta del servidor");

    const result = await response.json();

    if (result.config && result.config.iiif_url) {
      iiifBaseUrl = result.config.iiif_url;
    }

    currentArtworks = result.data || [];
    hideStatus();

    if (currentArtworks.length === 0) {
      galleryGrid.innerHTML = "<p>No se encontraron obras para esta búsqueda.</p>";
      updatePaginationControls(0);
      return;
    }

    renderGallery(currentArtworks);
    updatePaginationControls(result.pagination ? result.pagination.total_pages : 1);

  } catch (error) {
    console.error("Error al obtener obras:", error);
    showStatus("Ocurrió un error al cargar las obras. Intenta nuevamente.");
  }
}

// Renderizar la Galería
function renderGallery(artworks) {
  galleryGrid.innerHTML = "";

  artworks.forEach((art) => {
    // Usamos tamaño /400,/ para máxima compatibilidad sin bloqueos CORP
    const imageUrl = art.image_id
      ? `${iiifBaseUrl}/${art.image_id}/full/400,/0/default.jpg`
      : "https://via.placeholder.com/400x300?text=Imagen+no+disponible";

    const isFav = favorites.some((fav) => fav.id === art.id);

    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <img src="${imageUrl}" alt="${escapeHtml(art.title)}" referrerpolicy="no-referrer" loading="lazy">
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(art.title)}</h3>
        <p class="card-artist">${escapeHtml(art.artist_title || "Artista no especificado")}</p>
        <div class="card-actions">
          <button class="btn-detail" onclick="openDetail(${art.id})">Detalles</button>
          <button class="btn-fav" onclick="toggleFavorite(${art.id})">
            ${isFav ? "♥ Quitar Fav" : "♡ Favorito"}
          </button>
        </div>
      </div>
    `;

    galleryGrid.appendChild(card);
  });
}

// Búsqueda
function handleSearch(e) {
  e.preventDefault();
  currentQuery = searchInput.value.trim();
  currentPage = 1;
  fetchArtworks();
}

// Paginación
function changePage(direction) {
  currentPage += direction;
  fetchArtworks();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updatePaginationControls(totalPages) {
  pageInfo.textContent = `Página ${currentPage}`;
  btnPrev.disabled = currentPage <= 1;
  btnNext.disabled = currentPage >= totalPages || totalPages === 0;
}

// Detalle en Modal
function openDetail(artId) {
  const art = currentArtworks.find((a) => a.id === artId) || favorites.find((f) => f.id === artId);
  if (!art) return;

  const imageUrl = art.image_id
    ? `${iiifBaseUrl}/${art.image_id}/full/843,/0/default.jpg`
    : "https://via.placeholder.com/400x300?text=Imagen+no+disponible";

  detailBody.innerHTML = `
    <h2 style="margin-bottom: 1rem;">${escapeHtml(art.title)}</h2>
    <img src="${imageUrl}" alt="${escapeHtml(art.title)}" referrerpolicy="no-referrer" style="width: 100%; border-radius: 4px; margin-bottom: 1rem;">
    <p><strong>Artista:</strong> ${escapeHtml(art.artist_title || "Desconocido")}</p>
    <p><strong>Fecha:</strong> ${escapeHtml(art.date_display || "Desconocida")}</p>
    <p><strong>Técnica:</strong> ${escapeHtml(art.medium_display || "No especificada")}</p>
    <p><strong>Dominio Público:</strong> ${art.is_public_domain ? "Sí" : "No"}</p>
  `;

  detailModal.classList.remove("hidden");
  detailModal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  detailModal.classList.add("hidden");
  detailModal.setAttribute("aria-hidden", "true");
}

// Manejo de Favoritos
function toggleFavorite(artId) {
  const art = currentArtworks.find((a) => a.id === artId) || favorites.find((f) => f.id === artId);
  if (!art) return;

  const index = favorites.findIndex((fav) => fav.id === artId);
  if (index >= 0) {
    favorites.splice(index, 1);
  } else {
    favorites.push(art);
  }

  localStorage.setItem("museo_favoritos", JSON.stringify(favorites));
  renderGallery(currentArtworks);
  renderFavorites();
}

function renderFavorites() {
  favoritesGrid.innerHTML = "";

  if (favorites.length === 0) {
    favoritesGrid.innerHTML = "<p>No has guardado obras favoritas aún.</p>";
    return;
  }

  favorites.forEach((art) => {
    const imageUrl = art.image_id
      ? `${iiifBaseUrl}/${art.image_id}/full/400,/0/default.jpg`
      : "https://via.placeholder.com/400x300?text=Imagen+no+disponible";

    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <img src="${imageUrl}" alt="${escapeHtml(art.title)}" referrerpolicy="no-referrer" loading="lazy">
      <div class="card-body">
        <h3 class="card-title">${escapeHtml(art.title)}</h3>
        <p class="card-artist">${escapeHtml(art.artist_title || "Artista no especificado")}</p>
        <div class="card-actions">
          <button class="btn-detail" onclick="openDetail(${art.id})">Detalles</button>
          <button class="btn-fav" onclick="toggleFavorite(${art.id})">♥ Quitar Fav</button>
        </div>
      </div>
    `;

    favoritesGrid.appendChild(card);
  });
}

// Utilidades
function showStatus(msg) {
  statusMessage.textContent = msg;
  statusMessage.classList.remove("hidden");
}

function hideStatus() {
  statusMessage.classList.add("hidden");
}

function showValidation(msg) {
  validationMsg.textContent = msg;
  validationMsg.classList.remove("hidden");
}

function hideValidation() {
  validationMsg.classList.add("hidden");
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[m]);
}