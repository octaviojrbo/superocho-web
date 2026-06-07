/* =====================================
   EFECTO DACSA
   LOGO GRANDE -> LOGO PEQUEÑO
===================================== */

window.addEventListener("scroll", () => {
  const header = document.querySelector(".topbar");

  if (!header) return;

  if (window.scrollY > 180) {
    header.classList.add("scrolled");
  } else {
    header.classList.remove("scrolled");
  }
});

/* =========================
   AÑO AUTOMÁTICO FOOTER
========================= */

const yearElement = document.getElementById("year");

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

/* =========================
   SCRIPT PRINCIPAL
========================= */

console.log("Script principal cargado");

/* =========================
   CREAR SLUG
========================= */

function createSlug(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
}

/* =========================
   BOTONES DE CATEGORÍAS
   INICIO Y CATÁLOGO
========================= */

async function loadCategoryButtons() {
  const container =
    document.getElementById("homeCategories") ||
    document.getElementById("catalogCategoryButtons");

  if (!container) return;

  const { data, error } = await supabaseClient
    .from("categories")
    .select("*")
    .eq("show_home", true)
    .eq("visible", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error cargando categorías:", error);
    return;
  }

  container.innerHTML = data.map(category => {
    const slug = createSlug(category.name);

    return `
      <a href="catalogo.html#${slug}" class="category-card">
        <div style="font-size:2rem;margin-bottom:10px;">
          ${category.icon || ""}
        </div>

        <div>
          ${category.name}
        </div>
      </a>
    `;
  }).join("");
}

loadCategoryButtons();


/* =========================
   SECCIONES DEL CATÁLOGO
   DESDE SUPABASE
========================= */

async function loadCatalogSections(){

  const container = document.getElementById("catalogSections");

  if(!container) return;

  const { data: categories, error: categoriesError } = await supabaseClient
    .from("categories")
    .select("*")
    .eq("visible", true)
    .order("created_at", { ascending:true });

  if(categoriesError){
    console.error(categoriesError);
    return;
  }

  const mainCategories =
    categories.filter(category => !category.parent_id);

  let html = "";

  async function renderProductCard(product){

    const storesText = await getProductStoresText(product.id);

    const images = await getProductImages(
      product.id,
      product.image_url
    );

    const carouselId = `carousel-${product.id}`;

    let storesHtml = "";

    if(storesText){

      const totalStores = storesText.split(",").length;

      storesHtml = `
        <div class="product-stores-badge">

          ${
            totalStores === 1
              ? `<span>📍 Disponible en sucursal</span>`
              : `<span>📍 Disponible en las sucursales</span>`
          }

          <strong>${storesText}</strong>

        </div>
      `;
    }

    return `
      
        <div
          class="catalog-item"
          data-product-id="${product.id}"
          data-category-id="${product.category_id || ""}"
          data-subcategory-id="${product.subcategory_id || ""}"
        >

        <div class="product-labels">
          ${product.is_new ? `<span class="product-label new">Nuevo</span>` : ""}
          ${product.is_offer ? `<span class="product-label offer">Oferta</span>` : ""}
        </div>

        <div class="product-carousel">

          ${
            images.length > 1
              ? `
                <button
                  class="carousel-btn prev hidden-carousel-btn"
                  onclick="moveSmartCarousel('${carouselId}', -1)"
                >
                  ❮
                </button>
              `
              : ""
          }

          <div
            id="${carouselId}"
            class="carousel-images"
          >

            ${images.map((image, index) => `
              <img
                src="${image}"
                alt="${product.name}"
                class="carousel-image"
                loading="lazy"
                onclick='trackProductEvent(${product.id},"image_zoom"); openImageZoom(${JSON.stringify(images)}, ${index})'
                onerror="this.src='assets/placeholder.jpg'"
              >
            `).join("")}

          </div>

          <div class="carousel-counter">
            1 / ${images.length}
          </div>

          <div class="carousel-dots">
            ${images.map((_, index) => `
              <span
                class="carousel-dot ${index === 0 ? "active" : ""}"
              ></span>
            `).join("")}
          </div>

          ${
            images.length > 1
              ? `
                <button
                  class="carousel-btn next"
                  onclick="moveSmartCarousel('${carouselId}', 1)"
                >
                  ❯
                </button>
              `
              : ""
          }

        </div>

        <h3>${product.name}</h3>

        <p>
          ${product.description || ""}
        </p>

        <strong>
          ${product.price || ""}
        </strong>

        <button
          type="button"
          class="share-icon-btn"
          onclick='shareProduct(
            ${product.id},
            ${JSON.stringify(product.name)},
            ${JSON.stringify(product.description || "")},
            ${JSON.stringify(product.price || "")}
          )'
          title="Compartir producto"
        >
          <i class="fa-solid fa-share-nodes"></i>
        </button>

        ${storesHtml}

      </div>
    `;
  }

  for(const category of mainCategories){

    const slug = createSlug(category.name);

    let categoryContent = "";

    const { data: productsWithoutSub, error: productsWithoutSubError } =
      await supabaseClient
        .from("products")
        .select("*")
        .eq("active", true)
        .eq("category_id", category.id)
        .is("subcategory_id", null)
        .order("display_order", { ascending:true });

    if(productsWithoutSubError){
      console.error(productsWithoutSubError);
    }

    if(productsWithoutSub && productsWithoutSub.length > 0){

      categoryContent += `
        <div class="catalog-grid">
      `;

      for(const product of productsWithoutSub){
        categoryContent += await renderProductCard(product);
      }

      categoryContent += `
        </div>
      `;
    }

    const subcategories =
      categories.filter(
        sub => Number(sub.parent_id) === Number(category.id)
      );

    for(const subcategory of subcategories){

      const { data: products, error: productsError } = await supabaseClient
        .from("products")
        .select("*")
        .eq("active", true)
        .eq("category_id", category.id)
        .eq("subcategory_id", subcategory.id)
        .order("display_order", { ascending:true });

      if(productsError){
        console.error(productsError);
        continue;
      }

      if(!products || products.length === 0) continue;

      categoryContent += `
        <div class="catalog-subcategory-title">
          <h3>${subcategory.icon || ""} ${subcategory.name}</h3>
        </div>

        <div class="catalog-grid">
      `;

      for(const product of products){
        categoryContent += await renderProductCard(product);
      }

      categoryContent += `
        </div>
      `;
    }

    if(!categoryContent){
      categoryContent = `
        <div class="catalog-grid">
          <div class="catalog-item">
            <h3>Próximamente</h3>
          </div>
        </div>
      `;
    }

    html += `
      <section id="${slug}" class="catalog-section">

        <h2>
          ${category.icon || ""}
          ${category.name}
        </h2>

        ${categoryContent}

      </section>
    `;
  }

  container.innerHTML = html;

  document
    .querySelectorAll(".carousel-images")
    .forEach(carousel => {
      updateCarouselButtons(carousel.id);
      updateCarouselDots(carousel.id);
      updateCarouselCounter(carousel.id);
    });

  setupCatalogSearch();
  setupProductViews();
}

loadCatalogSections();

/* =========================
   FILTROS CATÁLOGO
========================= */

async function loadCatalogFilters(){

  const container =
    document.getElementById("catalogFilters");

  if(!container) return;

  const { data: categories, error } = await supabaseClient
    .from("categories")
    .select("*")
    .eq("visible", true)
    .order("created_at", { ascending:true });

  if(error){
    console.error("Error cargando filtros:", error);
    return;
  }

  const mainCategories =
    categories.filter(category => !category.parent_id);

  let html = `
    <label class="catalog-filter-option">
      <input
        type="radio"
        name="catalogFilter"
        value="all"
        checked
      >
      <span>Todos los productos</span>
    </label>
  `;

  mainCategories.forEach(category => {

    html += `
      <div class="catalog-filter-group">

        <label class="catalog-filter-option">
          <input
            type="radio"
            name="catalogFilter"
            value="category-${category.id}"
          >
          <span>${category.icon || ""} ${category.name}</span>
        </label>
    `;

    const subcategories =
      categories.filter(
        sub => Number(sub.parent_id) === Number(category.id)
      );

    if(subcategories.length > 0){

      html += `<div class="catalog-filter-subgroup">`;

      subcategories.forEach(sub => {

        html += `
          <label class="catalog-filter-option sub">
            <input
              type="radio"
              name="catalogFilter"
              value="subcategory-${sub.id}"
            >
            <span>${sub.icon || ""} ${sub.name}</span>
          </label>
        `;

      });

      html += `</div>`;
    }

    html += `</div>`;
  });

  container.innerHTML = html;

  container
    .querySelectorAll("input[name='catalogFilter']")
    .forEach(input => {
      input.addEventListener("change", applyCatalogFiltersWithSearch);
    });
}

loadCatalogFilters();

function applyCatalogFilters(){

  const selected =
    document.querySelector("input[name='catalogFilter']:checked");

  const filterValue =
    selected ? selected.value : "all";

  const cards =
    document.querySelectorAll(".catalog-item");

  cards.forEach(card => {

    const categoryId =
      card.dataset.categoryId;

    const subcategoryId =
      card.dataset.subcategoryId;

    let show = true;

    if(filterValue.startsWith("category-")){
      const selectedCategory =
        filterValue.replace("category-", "");

      show = categoryId === selectedCategory;
    }

    if(filterValue.startsWith("subcategory-")){
      const selectedSubcategory =
        filterValue.replace("subcategory-", "");

      show = subcategoryId === selectedSubcategory;
    }

    card.style.display = show ? "" : "none";

  });

  updateCatalogVisibleSections();
}

function updateCatalogVisibleSections(){

  document
    .querySelectorAll(".catalog-section")
    .forEach(section => {

      const visibleProducts =
        section.querySelectorAll(
          ".catalog-item:not([style*='display: none'])"
        );

      section.style.display =
        visibleProducts.length > 0 ? "block" : "none";

    });

  document
    .querySelectorAll(".catalog-subcategory-title")
    .forEach(title => {

      let next =
        title.nextElementSibling;

      let hasVisibleProduct = false;

      if(next && next.classList.contains("catalog-grid")){

        const visibleProducts =
          next.querySelectorAll(
            ".catalog-item:not([style*='display: none'])"
          );

        hasVisibleProduct =
          visibleProducts.length > 0;
      }

      title.style.display =
        hasVisibleProduct ? "" : "none";

    });
}

/* =========================
   PROMOCIÓN DESTACADA INICIO
========================= */
async function loadHomePromotion(){

  const container = document.getElementById("homePromotion");

  if(!container) return;

  const { data, error } = await supabaseClient
    .from("promotions")
    .select("*")
    .eq("show_home", true)
    .order("display_order", { ascending:true })
    .order("created_at", { ascending:false });

  if(error){
    console.error("Error cargando promociones de inicio:", error);
    return;
  }

  if(!data || data.length === 0){
    container.innerHTML = "";
    return;
  }

  container.innerHTML = data.map(promo => `
    <div class="home-promo-image-card">
      <img
        src="${promo.image_url || 'assets/placeholder.jpg'}"
        alt="Promoción Super 8"
      >
    </div>
  `).join("");
}

/* =========================
   PÁGINA PROMOCIONES
========================= */
async function loadPromotionsPage(){

  const container = document.getElementById("promotionsGrid");

  if(!container) return;

  const { data, error } = await supabaseClient
    .from("promotions")
    .select("*")
    .eq("show_catalog", true)
    .order("display_order", { ascending:true })
    .order("created_at", { ascending:false });

  if(error){
    console.error("Error cargando promociones:", error);
    return;
  }

  if(!data || data.length === 0){

    container.innerHTML = `
      <div class="promotion-empty">
        Próximamente tendremos nuevas promociones.
      </div>
    `;

    return;
  }

  container.innerHTML = data.map(promo => `
    <div class="promotion-image-card">
      <img
        src="${promo.image_url || 'assets/placeholder.jpg'}"
        alt="Promoción Super 8"
        loading="lazy"
      >
    </div>
  `).join("");
}
loadHomePromotion();
loadPromotionsPage();
/* =========================
   BUSCADOR CATÁLOGO
========================= */
function setupCatalogSearch(){

  const searchInput =
    document.getElementById("catalogSearchInput");

  if(!searchInput) return;

  searchInput.addEventListener("input", () => {

    const searchText =
      searchInput.value.toLowerCase().trim();

    const productCards =
      document.querySelectorAll(".catalog-item");

    productCards.forEach(card => {

      const cardText =
        card.textContent.toLowerCase();

      card.dataset.searchMatch =
        cardText.includes(searchText)
          ? "true"
          : "false";

    });

    applyCatalogFiltersWithSearch();

  });
}

function applyCatalogFiltersWithSearch(){

  const selected =
    document.querySelector("input[name='catalogFilter']:checked");

  const filterValue =
    selected ? selected.value : "all";

  const cards =
    document.querySelectorAll(".catalog-item");

  cards.forEach(card => {

    const categoryId =
      card.dataset.categoryId;

    const subcategoryId =
      card.dataset.subcategoryId;

    const searchMatch =
      card.dataset.searchMatch !== "false";

    let filterMatch = true;

    if(filterValue.startsWith("category-")){
      filterMatch =
        categoryId === filterValue.replace("category-", "");
    }

    if(filterValue.startsWith("subcategory-")){
      filterMatch =
        subcategoryId === filterValue.replace("subcategory-", "");
    }

    card.style.display =
      filterMatch && searchMatch ? "" : "none";

  });

  updateCatalogVisibleSections();
}

async function getProductStoresText(productId){

  const { data: productStores, error: psError } = await supabaseClient
    .from("product_stores")
    .select("*")
    .eq("product_id", productId);

  if(psError || !productStores?.length){
    return "";
  }

  const storeIds = productStores.map(row => row.store_id);

  const { data: stores, error: storesError } = await supabaseClient
    .from("stores")
    .select("*")
    .in("id", storeIds);

  if(storesError || !stores?.length){
    return "";
  }

  return stores.map(store => store.name).join(", ");
}


async function getProductImages(productId, mainImage){

  const { data, error } = await supabaseClient
    .from("product_images")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending:true });

  if(error || !data || data.length === 0){
    return [mainImage || "assets/placeholder.jpg"];
  }

  return data.map(img => img.image_url);
}



function moveSmartCarousel(carouselId, direction){

  const carousel = document.getElementById(carouselId);
  if(!carousel) return;

  const image = carousel.querySelector(".carousel-image");
  if(!image) return;

  const imageWidth = image.offsetWidth;
  const currentIndex = Math.round(carousel.scrollLeft / imageWidth);
  const totalImages = carousel.querySelectorAll(".carousel-image").length;

  let newIndex = currentIndex + direction;

  if(newIndex < 0) newIndex = 0;
  if(newIndex > totalImages - 1) newIndex = totalImages - 1;

  carousel.scrollTo({
    left:imageWidth * newIndex,
    behavior:"smooth"
  });

  setTimeout(() => {
    updateCarouselButtons(carouselId);
    updateCarouselDots(carouselId);
    updateCarouselCounter(carouselId);
  }, 350);
}


function updateCarouselDots(carouselId){

  const carousel = document.getElementById(carouselId);
  if(!carousel) return;

  const image = carousel.querySelector(".carousel-image");
  if(!image) return;

  const imageWidth = image.offsetWidth;
  const currentIndex = Math.round(carousel.scrollLeft / imageWidth);

  const dots =
    carousel.parentElement.querySelectorAll(".carousel-dot");

  dots.forEach((dot, index) => {
    dot.classList.toggle("active", index === currentIndex);
  });
}

function updateCarouselCounter(carouselId){

  const carousel = document.getElementById(carouselId);
  if(!carousel) return;

  const image = carousel.querySelector(".carousel-image");
  if(!image) return;

  const imageWidth = image.offsetWidth;
  const currentIndex = Math.round(carousel.scrollLeft / imageWidth);
  const totalImages = carousel.querySelectorAll(".carousel-image").length;

  const counter = carousel.parentElement.querySelector(".carousel-counter");

  if(counter){
    counter.textContent = `${currentIndex + 1} / ${totalImages}`;
  }
}

function updateCarouselButtons(carouselId){

  const carousel = document.getElementById(carouselId);
  if(!carousel) return;

  const wrapper = carousel.closest(".product-carousel");
  if(!wrapper) return;

  const prevBtn = wrapper.querySelector(".carousel-btn.prev");
  const nextBtn = wrapper.querySelector(".carousel-btn.next");

  const image = carousel.querySelector(".carousel-image");
  if(!image) return;

  const imageWidth = image.offsetWidth;
  const currentIndex = Math.round(carousel.scrollLeft / imageWidth);
  const totalImages = carousel.querySelectorAll(".carousel-image").length;

  if(prevBtn){
    prevBtn.classList.toggle("hidden-carousel-btn", currentIndex === 0);
  }

  if(nextBtn){
    nextBtn.classList.toggle("hidden-carousel-btn", currentIndex >= totalImages - 1);
  }
}


function openImageZoom(images, index){

  let currentIndex = index;

  const zoom = document.createElement("div");
  zoom.className = "image-zoom-overlay";

  function renderZoom(){

    zoom.innerHTML = `
      <button class="image-zoom-close">×</button>

      ${
        images.length > 1 && currentIndex > 0
          ? `<button class="image-zoom-arrow left">❮</button>`
          : ""
      }

      <img
        id="zoomed-image"
        src="${images[currentIndex]}"
        alt="Imagen ampliada"
        onerror="this.src='assets/placeholder.jpg'"
      >

      ${
        images.length > 1 && currentIndex < images.length - 1
          ? `<button class="image-zoom-arrow right">❯</button>`
          : ""
      }

      <div class="image-zoom-counter">
        ${currentIndex + 1} / ${images.length}
      </div>
    `;

    zoom.querySelector(".image-zoom-close").onclick = () => {
      zoom.remove();
    };

    const zoomedImage = zoom.querySelector("#zoomed-image");
 
    let scale = 1;

      zoomedImage.onclick = (e) => {
        e.stopPropagation();

        scale = scale === 1 ? 2.3 : 1;

        zoomedImage.style.transform = `scale(${scale})`;
        zoomedImage.style.cursor = scale === 1 ? "zoom-in" : "zoom-out";
      };


    const leftBtn = zoom.querySelector(".image-zoom-arrow.left");
    const rightBtn = zoom.querySelector(".image-zoom-arrow.right");

    if(leftBtn){
      leftBtn.onclick = (e) => {
        e.stopPropagation();
        currentIndex--;
        renderZoom();
      };
    }

    if(rightBtn){
      rightBtn.onclick = (e) => {
        e.stopPropagation();
        currentIndex++;
        renderZoom();
      };
    }
  }

  renderZoom();
  document.body.appendChild(zoom);
}



async function shareProduct(name, description, price){

  trackProductEvent(productId, "share_click");
  const text =
    `${name}\n${description ? description + "\n" : ""}${price ? "Precio: " + price + "\n" : ""}Catálogo Super 8`;

  const shareData = {
    title: name,
    text,
    url: window.location.href
  };

  if(navigator.share){
    try{
      await navigator.share(shareData);
      return;
    }catch(error){
      console.log("Compartir cancelado:", error);
    }
  }

  const whatsappText =
    encodeURIComponent(`${text}\n${window.location.href}`);

  window.open(
    `https://wa.me/?text=${whatsappText}`,
    "_blank"
  );
}


async function trackProductEvent(productId, eventType){

  try{

    await supabaseClient
      .from("product_analytics")
      .insert([
        {
          product_id: productId,
          event_type: eventType,
          page: window.location.pathname
        }
      ]);

  }catch(error){

    console.error(
      "Error guardando analytics:",
      error
    );

  }
}



function setupProductViews(){

  const observer =
    new IntersectionObserver(entries => {

      entries.forEach(entry => {

        if(!entry.isIntersecting) return;

        const productId =
          entry.target.dataset.productId;

        if(!productId) return;

        if(entry.target.dataset.viewTracked) return;

        entry.target.dataset.viewTracked = "true";

        trackProductEvent(
          Number(productId),
          "product_view"
        );

      });

    },{
      threshold:0.5
    });

  document
    .querySelectorAll(".catalog-item[data-product-id]")
    .forEach(card => {
      observer.observe(card);
    });
}

const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const mobileMenu = document.getElementById("mobileMenu");

if(mobileMenuBtn && mobileMenu){

  mobileMenuBtn.addEventListener("click", () => {
    mobileMenu.classList.toggle("active");
  });

}