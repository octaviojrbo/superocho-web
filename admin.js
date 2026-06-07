/* =========================
   PROTEGER PANEL ADMIN
========================= */

async function checkAdminSession(){

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if(!session){
    window.location.href = "login.html";
    return false;
  }

  return true;
}


console.log("Admin JS cargado");

/* =========================
   VARIABLES GLOBALES
========================= */

let editingProductId = null;
let editingCategoryId = null;
let editingPromotionId = null;

/* =========================
   CARGAR CATEGORÍAS EN SELECT
========================= */

async function loadCategoriesAdmin() {

    const categorySelect =
        document.getElementById("productCategory");

    const subcategorySelect =
        document.getElementById("productSubcategory");

    const parentSelect =
        document.getElementById("categoryParent");

    const { data, error } = await supabaseClient
        .from("categories")
        .select("*")
        .order("created_at", { ascending:true });

    if(error){
        console.error("Error cargando categorías:", error);
        return;
    }

    const mainCategories =
        data.filter(category => !category.parent_id);

    if(categorySelect){

        categorySelect.innerHTML =
            `<option value="">Selecciona una categoría</option>`;

        mainCategories.forEach(category => {

            const option =
                document.createElement("option");

            option.value = category.id;

            option.textContent =
                `${category.icon || ""} ${category.name}`;

            categorySelect.appendChild(option);

        });

        categorySelect.onchange = () => {

            if(!subcategorySelect) return;

            subcategorySelect.innerHTML =
                `<option value="">Sin subcategoría</option>`;

            const selectedCategoryId =
                Number(categorySelect.value);

            const subcategories =
                data.filter(
                    category =>
                        Number(category.parent_id) === selectedCategoryId
                );

            subcategories.forEach(subcategory => {

                const option =
                    document.createElement("option");

                option.value = subcategory.id;

                option.textContent =
                    `${subcategory.icon || ""} ${subcategory.name}`;

                subcategorySelect.appendChild(option);

            });

        };

    }

    if(subcategorySelect){
        subcategorySelect.innerHTML =
            `<option value="">Sin subcategoría</option>`;
    }

    if(parentSelect){

        parentSelect.innerHTML =
            `<option value="">Ninguna (categoría principal)</option>`;

        mainCategories.forEach(category => {

            const option =
                document.createElement("option");

            option.value = category.id;

            option.textContent =
                `${category.icon || ""} ${category.name}`;

            parentSelect.appendChild(option);

        });

    }
}

/* =========================
   GUARDAR O EDITAR PRODUCTO
========================= */

const productForm = document.getElementById("productForm");
const adminMessage = document.getElementById("adminMessage");

if (productForm) {
    productForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        adminMessage.textContent = editingProductId
            ? "Editando producto..."
            : "Guardando producto...";

        const name = document.getElementById("productName").value;
        const description = document.getElementById("productDescription").value;
        const rawPrice = document.getElementById("productPrice").value;

        const price = formatProductPrice(rawPrice);
        const category_id = document.getElementById("productCategory").value;
        const subcategory_id =
            document.getElementById("productSubcategory").value;
        const imageFiles = document.getElementById("productImage").files;

        let image_url = null;

        if (imageFiles && imageFiles.length > 0) {

            const firstImage = imageFiles[0];

            const cleanFirstImageName = firstImage.name
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-zA-Z0-9.]/g, "-")
                .toLowerCase();

            const fileName = `products/${Date.now()}-${cleanFirstImageName}`;

            const { error: uploadError } = await supabaseClient
                .storage
                .from("super8-images")
                .upload(fileName, firstImage);

            if (uploadError) {
                console.error(uploadError);
                adminMessage.textContent = "Error al subir la imagen principal.";
                return;
            }

            const { data: publicUrlData } = supabaseClient
                .storage
                .from("super8-images")
                .getPublicUrl(fileName);

            image_url = publicUrlData.publicUrl;
        }

        const productData = {
            name,
            description,
            price,
            category_id: Number(category_id),
            subcategory_id: subcategory_id
                ? Number(subcategory_id)
                : null,
            active: true,
            show_home: false
        };

        if (image_url) {
            productData.image_url = image_url;
        }

        let result;

        if (editingProductId) {
            result = await supabaseClient
                .from("products")
                .update(productData)
                .eq("id", editingProductId);
        } else {
            result = await supabaseClient
                .from("products")
                .insert([productData])
                .select();
        }

        if (result.error) {
            console.error(result.error);
            adminMessage.textContent = "Error al guardar el producto.";
            return;
        }

        const savedProductId = editingProductId || result.data?.[0]?.id;

        if (savedProductId) {

            await saveProductStores(savedProductId);

            await saveProductImages(
                savedProductId,
                imageFiles
            );

        }

        adminMessage.textContent = editingProductId
            ? "Producto editado correctamente."
            : "Producto guardado correctamente.";

        editingProductId = null;
        productForm.reset();

        const currentImagePreview = document.getElementById("currentImagePreview");

        if (currentImagePreview) {
            currentImagePreview.innerHTML = "";
        }

        document.querySelectorAll(".store-checkbox").forEach(checkbox => {
            checkbox.checked = false;
        });

        loadAdminProducts();
        loadAdminStats();

    });
}

/* =========================
   MOSTRAR PRODUCTOS EN ADMIN
========================= */

async function loadAdminProducts() {

    const container = document.getElementById("adminProductsList");

    if (!container) return;

    const { data: categories, error: categoriesError } = await supabaseClient
        .from("categories")
        .select("*")
        .order("created_at", { ascending: true });

    if (categoriesError) {
        console.error(categoriesError);
        container.innerHTML = "<p>Error al cargar categorías.</p>";
        return;
    }

    const mainCategories =
        categories.filter(category => !category.parent_id);

    let html = "";

    function renderProductCard(product, products, index, categoryId) {

        return getProductStoresText(product.id).then(async storesText => {

            const images =
                await getAdminProductImages(product.id, product.image_url);

            const adminCarouselId =
                `admin-carousel-${product.id}`;

            return `
                <div class="admin-product-item" data-product-id="${product.id}">

                    <div class="admin-mini-carousel">

                        ${
                            images.length > 1
                            ? `
                                <button
                                    type="button"
                                    class="admin-carousel-btn prev hidden-carousel-btn"
                                    onclick="moveAdminSmartCarousel('${adminCarouselId}', -1)"
                                >
                                    ❮
                                </button>
                            `
                            : ""
                        }

                        <div id="${adminCarouselId}" class="admin-carousel-images">
                            ${images.map(image => `
                                <img src="${image}" alt="${product.name}">
                            `).join("")}
                        </div>

                        ${
                            images.length > 1
                            ? `
                                <button
                                    type="button"
                                    class="admin-carousel-btn next"
                                    onclick="moveAdminSmartCarousel('${adminCarouselId}', 1)"
                                >
                                    ❯
                                </button>
                            `
                            : ""
                        }

                    </div>

                    <div>
                        <h3>${product.name}</h3>
                        <p>${product.description || ""}</p>
                        <strong>${product.price || ""}</strong>
                        <small>Orden: ${product.display_order || 0}</small>
                        <br>
                        <small class="product-status-text">
                            ${product.active ? "Visible en catálogo" : "Oculto del catálogo"}
                        </small>
                        <br>
                        <small>Sucursales: ${storesText}</small>
                    </div>

                    <div class="admin-actions">

                        ${
                            index > 0
                            ? `
                                <button
                                    type="button"
                                    class="move-btn"
                                    onclick="moveProduct(${product.id}, ${categoryId}, -1)"
                                >
                                    ↑ Subir
                                </button>
                            `
                            : ""
                        }

                        ${
                            index < products.length - 1
                            ? `
                                <button
                                    type="button"
                                    class="move-btn"
                                    onclick="moveProduct(${product.id}, ${categoryId}, 1)"
                                >
                                    ↓ Bajar
                                </button>
                            `
                            : ""
                        }

                        <button
                            type="button"
                            class="${product.active ? "hide-btn" : "show-btn"} tooltip-btn product-toggle-btn"
                            data-tooltip="${
                                product.active
                                    ? "Ocultar producto del catálogo"
                                    : "Mostrar producto en el catálogo"
                            }"
                            onclick="toggleProductVisibility(${product.id}, ${product.active})"
                        >
                            ${product.active ? "Ocultar" : "Mostrar"}
                        </button>
                        

                        <button
                            type="button"
                            class="${product.is_new ? "hide-btn" : "show-btn"}"
                            onclick="toggleProductNew(${product.id}, ${product.is_new})"
                        >
                            ${product.is_new ? "Quitar nuevo" : "Marcar nuevo"}
                        </button>

                        <button
                        type="button"
                        class="${product.is_offer ? "hide-btn" : "show-btn"}"
                        onclick="toggleProductOffer(${product.id}, ${product.is_offer})"
                        >
                        ${product.is_offer ? "Quitar oferta" : "Marcar oferta"}
                        </button>


                        <button
                            type="button"
                            class="edit-btn"
                            onclick="editProduct(${product.id})"
                        >
                            Editar
                        </button>

                        <button
                            type="button"
                            class="delete-btn"
                            onclick="deleteProduct(${product.id})"
                        >
                            Eliminar
                        </button>

                    </div>

                </div>
            `;
        });
    }

    for (const category of mainCategories) {

        const subcategories =
            categories.filter(
                sub => Number(sub.parent_id) === Number(category.id)
            );

        let categoryHtml = "";

        const { data: productsWithoutSub, error: productsWithoutSubError } =
            await supabaseClient
                .from("products")
                .select("*")
                .eq("category_id", category.id)
                .is("subcategory_id", null)
                .order("display_order", { ascending:true });

        if (productsWithoutSubError) {
            console.error(productsWithoutSubError);
        }

        if (productsWithoutSub && productsWithoutSub.length > 0) {

            for (let index = 0; index < productsWithoutSub.length; index++) {

                categoryHtml += await renderProductCard(
                    productsWithoutSub[index],
                    productsWithoutSub,
                    index,
                    category.id
                );

            }
        }

        for (const subcategory of subcategories) {

            const { data: products, error: productsError } = await supabaseClient
                .from("products")
                .select("*")
                .eq("category_id", category.id)
                .eq("subcategory_id", subcategory.id)
                .order("display_order", { ascending: true });

            if (productsError) {
                console.error(productsError);
                continue;
            }

            if (!products || products.length === 0) continue;

            categoryHtml += `
                <div class="admin-products-subcategory">
                    <h4>${subcategory.icon || ""} ${subcategory.name}</h4>
                </div>
            `;

            for (let index = 0; index < products.length; index++) {

                categoryHtml += await renderProductCard(
                    products[index],
                    products,
                    index,
                    category.id
                );

            }
        }

        if (categoryHtml) {
            html += `
                <div class="admin-products-category">
                    <h3>${category.icon || ""} ${category.name}</h3>
                </div>

                ${categoryHtml}
            `;
        }
    }

    container.innerHTML =
        html || "<p>No hay productos guardados.</p>";

    document
        .querySelectorAll(".admin-carousel-images")
        .forEach(carousel => {
            updateAdminCarouselButtons(carousel.id);
        });
    setupAdminProductSearch();
}


/* =========================
   EDITAR PRODUCTO
========================= */

async function editProduct(id) {

    const { data, error } = await supabaseClient
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
        console.error("Error al cargar producto para editar:", error);
        adminMessage.textContent = "Error al cargar producto.";
        return;
    }

    document.getElementById("productName").value = data.name || "";
    document.getElementById("productDescription").value = data.description || "";
    document.getElementById("productPrice").value = data.price || "";
    document.getElementById("productCategory").value = data.category_id || "";

    document
        .getElementById("productCategory")
        .dispatchEvent(new Event("change"));

        setTimeout(() => {
        document.getElementById("productSubcategory").value =
            data.subcategory_id || "";
        }, 100);

    await loadProductStores(id);
    await loadProductImagesPreview(id, data.image_url);

    editingProductId = id;

    adminMessage.textContent =
        "Editando producto. Si no seleccionas nuevas imágenes, se conservan las actuales.";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

/* =========================
   ELIMINAR PRODUCTO
========================= */

async function deleteProduct(id) {

    const confirmDelete = confirm("¿Seguro que quieres eliminar este producto?");

    if (!confirmDelete) return;

    await supabaseClient
        .from("product_images")
        .delete()
        .eq("product_id", id);

    await supabaseClient
        .from("product_stores")
        .delete()
        .eq("product_id", id);


    const { error } = await supabaseClient
        .from("products")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Error eliminando producto:", error);
        alert("No se pudo eliminar el producto.");
        return;
    }

    alert("Producto eliminado.");
    loadAdminProducts();
}

/* =========================
   GUARDAR O EDITAR CATEGORÍA
========================= */

const categoryForm = document.getElementById("categoryForm");
const categoryMessage = document.getElementById("categoryMessage");

if (categoryForm) {
    categoryForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        categoryMessage.textContent = editingCategoryId
            ? "Editando categoría..."
            : "Guardando categoría...";

        const name = document.getElementById("categoryName").value;
        const icon = document.getElementById("categoryIcon").value;
        const show_home = document.getElementById("categoryShowHome").checked;
        const parent_id =
            document.getElementById("categoryParent").value || null;

        let result;

        if (editingCategoryId) {
            result = await supabaseClient
                .from("categories")
                .update({
                    name,
                    icon,
                    show_home,
                    parent_id
                })
                .eq("id", editingCategoryId);
        } else {
            result = await supabaseClient
                .from("categories")
                .insert([
                    {
                        name,
                        icon,
                        show_home,
                        parent_id
                    }
                ]);
        }

        if (result.error) {
            console.error(result.error);
            categoryMessage.textContent = "Error al guardar categoría.";
            return;
        }

        categoryMessage.textContent = editingCategoryId
            ? "Categoría editada correctamente."
            : "Categoría guardada correctamente.";

        editingCategoryId = null;
        categoryForm.reset();

        loadCategoriesAdminList();
        loadCategoriesAdmin();
        loadAdminStats();
    });
}

/* =========================
   MOSTRAR CATEGORÍAS EN ADMIN
========================= */

async function loadCategoriesAdminList() {

    const container = document.getElementById("adminCategoriesList");

    if (!container) return;

    const { data, error } = await supabaseClient
        .from("categories")
        .select("*")
        .order("created_at", { ascending: true });

    if (error) {
        console.error(error);
        container.innerHTML = "<p>Error al cargar categorías.</p>";
        return;
    }

    if (data.length === 0) {
        container.innerHTML = "<p>No hay categorías guardadas.</p>";
        return;
    }

    let html = "";

    const mainCategories =
        data.filter(category => !category.parent_id);

    for (const category of mainCategories) {

        const { count: productCount } = await supabaseClient
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("category_id", category.id);

        const subcategories =
            data.filter(
                sub => Number(sub.parent_id) === Number(category.id)
            );

        let subcategoriesHtml = "";

        if (subcategories.length > 0) {

            subcategoriesHtml = `
                <div class="admin-subcategories-list">

                    ${subcategories.map(sub => `
                        <div class="admin-subcategory-item">

                            <div>
                                ↳ ${sub.icon || ""} ${sub.name}
                            </div>

                            <div class="admin-actions">

                                <button
                                    type="button"
                                    class="edit-btn"
                                    onclick="editCategory(${sub.id})"
                                >
                                    Editar
                                </button>

                                <button
                                    type="button"
                                    class="delete-btn"
                                    onclick="deleteCategory(${sub.id})"
                                >
                                    Eliminar
                                </button>

                            </div>

                        </div>
                    `).join("")}

                </div>
            `;
        }

        html += `
            <div class="admin-category-item category-card-admin">

                <div class="category-products-count">
                    ${productCount || 0} productos
                </div>

                <div>

                    <strong>
                        ${category.icon || ""} ${category.name}
                    </strong>

                    <small>
                        ${category.visible
                            ? "Visible en catálogo"
                            : "Oculta del catálogo"}
                    </small>

                    <br>

                    <small>
                        ${category.show_home
                            ? "Visible en inicio"
                            : "No visible en inicio"}
                    </small>

                </div>

                <div class="admin-actions">

                    <button
                        type="button"
                        class="${category.visible ? "hide-btn" : "show-btn"} tooltip-btn"
                        data-tooltip="${
                            category.visible
                                ? "Ocultar categoría del catálogo"
                                : "Mostrar categoría en el catálogo"
                        }"
                        onclick="toggleCategoryVisibility(${category.id}, ${category.visible})"
                    >
                        ${category.visible ? "Ocultar" : "Mostrar"}
                    </button>

                    <button
                        type="button"
                        class="edit-btn"
                        onclick="editCategory(${category.id})"
                    >
                        Editar
                    </button>

                    <button
                        type="button"
                        class="delete-btn"
                        onclick="deleteCategory(${category.id})"
                    >
                        Eliminar
                    </button>

                </div>

                ${subcategoriesHtml}

            </div>
        `;
    }

    container.innerHTML = html;
}

/* =========================
   EDITAR CATEGORÍA
========================= */

async function editCategory(id) {

    const { data, error } = await supabaseClient
        .from("categories")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
        console.error(error);
        categoryMessage.textContent = "Error al cargar categoría.";
        return;
    }

    document.getElementById("categoryName").value = data.name || "";
    document.getElementById("categoryIcon").value = data.icon || "";
    document.getElementById("categoryShowHome").checked = data.show_home || false;
    document.getElementById("categoryParent").value =
        data.parent_id || "";

    editingCategoryId = id;

    categoryMessage.textContent =
        "Editando categoría. Guarda para aplicar cambios.";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

/* =========================
   ELIMINAR CATEGORÍA
========================= */

async function deleteCategory(id) {

    const confirmDelete = confirm("¿Seguro que quieres eliminar esta categoría?");

    if (!confirmDelete) return;

    const { error } = await supabaseClient
        .from("categories")
        .delete()
        .eq("id", id);

    if (error) {
        console.error(error);
        alert("No se pudo eliminar la categoría.");
        return;
    }

    alert("Categoría eliminada.");
    loadCategoriesAdminList();
    loadCategoriesAdmin();
    loadAdminStats();
}




/* =========================
   GUARDAR O EDITAR PROMOCIÓN
========================= */

const promotionForm = document.getElementById("promotionForm");
const promotionMessage = document.getElementById("promotionMessage");

if(promotionForm){

  promotionForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    promotionMessage.textContent = editingPromotionId
      ? "Editando promoción..."
      : "Guardando promoción...";

    const imageFile =
      document.getElementById("promotionImage").files[0];

    const show_catalog =
      document.getElementById("promotionShowCatalog").checked;

    const show_home =
      document.getElementById("promotionShowHome").checked;

    let image_url = null;

    if(imageFile){

      const cleanFileName = imageFile.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9.]/g, "-")
        .toLowerCase();

      const fileName =
        `promotions/${Date.now()}-${cleanFileName}`;

      const { error: uploadError } = await supabaseClient
        .storage
        .from("super8-images")
        .upload(fileName, imageFile);

      if(uploadError){
        console.error(uploadError);
        promotionMessage.textContent =
          "Error al subir la imagen.";
        return;
      }

      const { data: publicUrlData } = supabaseClient
        .storage
        .from("super8-images")
        .getPublicUrl(fileName);

      image_url = publicUrlData.publicUrl;
    }

    const promotionData = {
      show_catalog,
      show_home,
      active:true
    };

    if(image_url){
      promotionData.image_url = image_url;
    }

    let result;

    if(editingPromotionId){

      result = await supabaseClient
        .from("promotions")
        .update(promotionData)
        .eq("id", editingPromotionId);

    }else{

      result = await supabaseClient
        .from("promotions")
        .insert([promotionData]);

    }

    if(result.error){
      console.error(result.error);
      promotionMessage.textContent =
        "Error al guardar promoción.";
      return;
    }

    promotionMessage.textContent = editingPromotionId
      ? "Promoción editada correctamente."
      : "Promoción guardada correctamente.";

    editingPromotionId = null;
    promotionForm.reset();

    document.getElementById("promotionShowCatalog").checked = true;
    document.getElementById("promotionShowHome").checked = false;

    const currentPromotionImagePreview =
      document.getElementById("currentPromotionImagePreview");

    if(currentPromotionImagePreview){
      currentPromotionImagePreview.innerHTML = "";
    }
    loadAdminPromotions();

    loadAdminStats();
    

  });

}

/* =========================
   MOSTRAR PROMOCIONES EN ADMIN
========================= */

async function loadAdminPromotions(){

  const container =
    document.getElementById("adminPromotionsList");

  if(!container) return;

  const { data, error } = await supabaseClient
    .from("promotions")
    .select("*")
    .order("display_order", { ascending:true })
    .order("created_at", { ascending:false });

  if(error){
    console.error(error);
    container.innerHTML =
      "<p>Error al cargar promociones.</p>";
    return;
  }

  if(!data || data.length === 0){
    container.innerHTML =
      "<p>No hay promociones guardadas.</p>";
    return;
  }

  container.innerHTML = data.map((promo, index) => `
    <div class="admin-promo-item" data-promo-id="${promo.id}">

      <img
        src="${promo.image_url || 'assets/placeholder.jpg'}"
        alt="Promoción Super 8"
      >

      <div>
        <strong>Promoción #${index + 1}</strong>

        <br>

        <small>
          ${promo.show_catalog
            ? "Visible en promociones"
            : "Oculta de promociones"}
        </small>

        <br>

        <small>
          ${promo.show_home
            ? "Visible en inicio"
            : "No visible en inicio"}
        </small>
      </div>

      <div class="admin-actions">

        ${
          index > 0
            ? `
              <button
                type="button"
                class="move-btn"
                onclick="movePromotion(${promo.id}, -1)"
              >
                ↑ Subir
              </button>
            `
            : ""
        }

        ${
          index < data.length - 1
            ? `
              <button
                type="button"
                class="move-btn"
                onclick="movePromotion(${promo.id}, 1)"
              >
                ↓ Bajar
              </button>
            `
            : ""
        }

        <button
          type="button"
          class="${promo.show_catalog ? "hide-btn" : "show-btn"}"
          onclick="togglePromotionCatalog(${promo.id}, ${promo.show_catalog})"
        >
          ${promo.show_catalog ? "Ocultar promociones" : "Mostrar promociones"}
        </button>

        <button
          type="button"
          class="${promo.show_home ? "hide-btn" : "show-btn"}"
          onclick="togglePromotionHome(${promo.id}, ${promo.show_home})"
        >
          ${promo.show_home ? "Ocultar inicio" : "Mostrar inicio"}
        </button>

        <button
          type="button"
          class="edit-btn"
          onclick="editPromotion(${promo.id})"
        >
          Editar
        </button>

        <button
          type="button"
          class="delete-btn"
          onclick="deletePromotion(${promo.id})"
        >
          Eliminar
        </button>

      </div>

    </div>
  `).join("");
}



/* =========================
   EDITAR PROMOCIÓN
========================= */

async function editPromotion(id){

  const { data, error } = await supabaseClient
    .from("promotions")
    .select("*")
    .eq("id", id)
    .single();

  if(error){
    console.error(error);
    return;
  }

  document.getElementById("promotionShowCatalog").checked =
    data.show_catalog ?? true;

  document.getElementById("promotionShowHome").checked =
    data.show_home || false;

  const currentPromotionImagePreview =
    document.getElementById("currentPromotionImagePreview");

  if(currentPromotionImagePreview && data.image_url){
    currentPromotionImagePreview.innerHTML = `
      <p>Imagen actual:</p>
      <img
        src="${data.image_url}"
        alt="Promoción actual"
        class="current-preview-img"
      >
    `;
  }

  editingPromotionId = id;

  promotionMessage.textContent =
    "Editando promoción. Si no seleccionas una nueva imagen, se conserva la actual.";

  window.scrollTo({
    top:0,
    behavior:"smooth"
  });
}

/* =========================
   ELIMINAR PROMOCIÓN
========================= */

async function deletePromotion(id){

  const confirmDelete =
    confirm("¿Seguro que quieres eliminar esta promoción?");

  if(!confirmDelete) return;

  const { error } = await supabaseClient
    .from("promotions")
    .delete()
    .eq("id", id);

  if(error){
    console.error(error);
    alert("No se pudo eliminar la promoción.");
    return;
  }

  alert("Promoción eliminada.");
  loadAdminPromotions();
  loadAdminStats();
}

/* =========================
   MOSTRAR / OCULTAR EN PROMOCIONES
========================= */

async function togglePromotionCatalog(id, currentStatus){

  const { error } = await supabaseClient
    .from("promotions")
    .update({
      show_catalog: !currentStatus
    })
    .eq("id", id);

  if(error){
    console.error(error);
    alert("No se pudo cambiar la visibilidad.");
    return;
  }

  loadAdminPromotions();
}

/* =========================
   MOSTRAR / OCULTAR EN INICIO
========================= */

async function togglePromotionHome(id, currentStatus){

  const { error } = await supabaseClient
    .from("promotions")
    .update({
      show_home: !currentStatus
    })
    .eq("id", id);

  if(error){
    console.error(error);
    alert("No se pudo cambiar la visibilidad en inicio.");
    return;
  }

  loadAdminPromotions();
}

/* =========================
   MOVER PROMOCIÓN
========================= */

async function movePromotion(id, direction){

  const { data: promotions, error } = await supabaseClient
    .from("promotions")
    .select("*")
    .order("display_order", { ascending:true })
    .order("created_at", { ascending:false });

  if(error){
    console.error(error);
    alert("No se pudo cargar el orden.");
    return;
  }

  const orderedPromotions = promotions.map((promo, index) => ({
    ...promo,
    cleanOrder:index + 1
  }));

  for(const promo of orderedPromotions){
    await supabaseClient
      .from("promotions")
      .update({ display_order:promo.cleanOrder })
      .eq("id", promo.id);
  }

  const currentIndex =
    orderedPromotions.findIndex(promo => promo.id === id);

  const targetIndex =
    currentIndex + direction;

  if(
    currentIndex === -1 ||
    targetIndex < 0 ||
    targetIndex >= orderedPromotions.length
  ){
    return;
  }

  const currentPromo =
    orderedPromotions[currentIndex];

  const targetPromo =
    orderedPromotions[targetIndex];

  await supabaseClient
    .from("promotions")
    .update({ display_order:targetPromo.cleanOrder })
    .eq("id", currentPromo.id);

  await supabaseClient
    .from("promotions")
    .update({ display_order:currentPromo.cleanOrder })
    .eq("id", targetPromo.id);


loadAdminPromotions();
  
}

/* =========================
   CAMBIAR SECCIÓN ADMIN
========================= */

const adminSectionSelector =
    document.getElementById("adminSectionSelector");

function showAdminSection(section) {

    const productsSection =
        document.getElementById("productsAdminSection");

    const categoriesSection =
        document.getElementById("categoriesAdminSection");

    const promotionsSection =
        document.getElementById("promotionsAdminSection");

    if (
        !productsSection ||
        !categoriesSection ||
        !promotionsSection
    ) {
        return;
    }

    productsSection.classList.add("hidden-admin-section");
    categoriesSection.classList.add("hidden-admin-section");
    promotionsSection.classList.add("hidden-admin-section");

    if (!section) {
        return;
    }

    if (section === "products") {
        productsSection.classList.remove("hidden-admin-section");
    }

    if (section === "categories") {
        categoriesSection.classList.remove("hidden-admin-section");
    }

    if (section === "promotions") {
        promotionsSection.classList.remove("hidden-admin-section");
    }
}

if (adminSectionSelector) {

    adminSectionSelector.addEventListener("change", () => {
        if (adminSectionSelector.value) {
            showAdminSection(adminSectionSelector.value);
        }
    });

    showAdminSection(adminSectionSelector.value);
}



/* =========================
   MOVER ORDEN PRODUCTO
   INTERCAMBIO REAL
========================= */

async function moveProduct(id, categoryId, direction) {

    const { data: products, error } = await supabaseClient
        .from("products")
        .select("*")
        .eq("category_id", categoryId)
        .order("display_order", { ascending: true });

    if (error) {
        console.error(error);
        alert("No se pudo cargar el orden.");
        return;
    }

    const orderedProducts = products.map((product, index) => ({
        ...product,
        cleanOrder: index + 1
    }));

    for (const product of orderedProducts) {
        await supabaseClient
            .from("products")
            .update({ display_order: product.cleanOrder })
            .eq("id", product.id);
    }

    const currentIndex = orderedProducts.findIndex(product => product.id === id);
    const targetIndex = currentIndex + direction;

    if (currentIndex === -1 || targetIndex < 0 || targetIndex >= orderedProducts.length) {
        return;
    }

    const currentProduct = orderedProducts[currentIndex];
    const targetProduct = orderedProducts[targetIndex];

    await supabaseClient
        .from("products")
        .update({ display_order: targetProduct.cleanOrder })
        .eq("id", currentProduct.id);

    await supabaseClient
        .from("products")
        .update({ display_order: currentProduct.cleanOrder })
        .eq("id", targetProduct.id);

    loadAdminProducts();
}


/* =========================
   ESTADÍSTICAS ADMIN
========================= */

async function loadAdminStats() {

    const totalProducts = document.getElementById("totalProducts");
    const totalCategories = document.getElementById("totalCategories");
    const totalSubcategories = document.getElementById("totalSubcategories");
    const totalPromotions = document.getElementById("totalPromotions");

    if (
        !totalProducts ||
        !totalCategories ||
        !totalSubcategories ||
        !totalPromotions
    ) return;

    const { count: productsCount } = await supabaseClient
        .from("products")
        .select("*", { count: "exact", head: true });

    const { count: categoriesCount } = await supabaseClient
        .from("categories")
        .select("*", { count: "exact", head: true });

    const { data: categoriesData } = await supabaseClient
        .from("categories")
        .select("parent_id");
    const subcategoriesCount =

        categoriesData?.filter(

            category => category.parent_id

        ).length || 0;
    const { count: promotionsCount } = await supabaseClient
        .from("promotions")
        .select("*", { count: "exact", head: true });

    totalProducts.textContent =
        productsCount || 0;

    totalCategories.textContent =
        (categoriesCount || 0) - subcategoriesCount;

    totalSubcategories.textContent =
        subcategoriesCount;

    totalPromotions.textContent =
        promotionsCount || 0;
}




/* =========================
   CARGAR SUCURSALES EN PRODUCTO
========================= */

async function loadStoresAdmin() {

    const container = document.getElementById("productStores");

    if (!container) return;

    const { data, error } = await supabaseClient
        .from("stores")
        .select("*")
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Error cargando sucursales:", error);
        return;
    }

    container.innerHTML = data.map(store => `
    <label class="store-checkbox-item">
      <input
        type="checkbox"
        value="${store.id}"
        class="store-checkbox"
      >
      ${store.name}
    </label>
  `).join("");
}





/* =========================
   OBTENER SUCURSALES SELECCIONADAS
========================= */

function getSelectedStores() {
    return Array.from(document.querySelectorAll(".store-checkbox:checked"))
        .map(checkbox => Number(checkbox.value));
}

/* =========================
   GUARDAR SUCURSALES DEL PRODUCTO
========================= */

async function saveProductStores(productId) {

    await supabaseClient
        .from("product_stores")
        .delete()
        .eq("product_id", productId);

    const selectedStores = getSelectedStores();

    if (selectedStores.length === 0) return;

    const rows = selectedStores.map(storeId => ({
        product_id: productId,
        store_id: storeId
    }));

    const { error } = await supabaseClient
        .from("product_stores")
        .insert(rows);

    if (error) {
        console.error("Error guardando sucursales:", error);
    }
}

/* =========================
   CARGAR SUCURSALES DEL PRODUCTO
========================= */

async function loadProductStores(productId) {

    document.querySelectorAll(".store-checkbox").forEach(checkbox => {
        checkbox.checked = false;
    });

    const { data, error } = await supabaseClient
        .from("product_stores")
        .select("*")
        .eq("product_id", productId);

    if (error) {
        console.error("Error cargando sucursales:", error);
        return;
    }

    data.forEach(row => {

        const checkbox = document.querySelector(
            `.store-checkbox[value="${row.store_id}"]`
        );

        if (checkbox) {
            checkbox.checked = true;
        }

    });

}


async function getProductStoresText(productId) {

    const { data: productStores, error: psError } = await supabaseClient
        .from("product_stores")
        .select("*")
        .eq("product_id", productId);

    if (psError) {
        console.error("Error cargando product_stores:", psError);
        return "Sin sucursal asignada";
    }

    if (!productStores || productStores.length === 0) {
        return "Sin sucursal asignada";
    }

    const storeIds = productStores.map(row => row.store_id);

    const { data: stores, error: storesError } = await supabaseClient
        .from("stores")
        .select("*")
        .in("id", storeIds);

    if (storesError) {
        console.error("Error cargando stores:", storesError);
        return "Sin sucursal asignada";
    }

    return stores
        .map(store => store.name)
        .join(", ");
}

/* =========================
   OCULTAR / MOSTRAR CATEGORÍA
========================= */

async function toggleCategoryVisibility(id, currentStatus) {

    const { error } = await supabaseClient
        .from("categories")
        .update({
            visible: !currentStatus
        })
        .eq("id", id);

    if (error) {
        console.error("Error cambiando visibilidad:", error);
        alert("No se pudo cambiar la visibilidad.");
        return;
    }

    loadCategoriesAdminList();
    loadCategoriesAdmin();
}


/* =========================
   OCULTAR / MOSTRAR PRODUCTO
========================= */

async function toggleProductVisibility(id, currentStatus) {

    const newStatus = !currentStatus;

    const { error } = await supabaseClient
        .from("products")
        .update({
            active: newStatus
        })
        .eq("id", id);

    if (error) {
        console.error("Error cambiando visibilidad:", error);
        alert("No se pudo cambiar la visibilidad.");
        return;
    }

    const productCard = document.querySelector(`[data-product-id="${id}"]`);

    if (!productCard) return;

    const statusText = productCard.querySelector(".product-status-text");
    const button = productCard.querySelector(".product-toggle-btn");

    if (statusText) {
        statusText.textContent = newStatus
            ? "Visible en catálogo"
            : "Oculto del catálogo";
    }

    if (button) {
        button.textContent = newStatus ? "Ocultar" : "Mostrar";

        button.classList.remove("hide-btn", "show-btn");
        button.classList.add(newStatus ? "hide-btn" : "show-btn");

        button.setAttribute(
            "data-tooltip",
            newStatus
                ? "Ocultar producto del catálogo"
                : "Mostrar producto en el catálogo"
        );

        button.setAttribute(
            "onclick",
            `toggleProductVisibility(${id}, ${newStatus})`
        );
    }
}



/* =========================
   GUARDAR IMÁGENES PRODUCTO
========================= */

async function saveProductImages(productId, imageFiles) {

    if (!imageFiles || imageFiles.length === 0) {
        return;
    }

    await supabaseClient
        .from("product_images")
        .delete()
        .eq("product_id", productId);

    const rows = [];

    for (const file of imageFiles) {

        const cleanFileName = file.name
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9.]/g, "-")
            .toLowerCase();

        const fileName =
            `products/${Date.now()}-${Math.random()}-${cleanFileName}`;

        const { error: uploadError } = await supabaseClient
            .storage
            .from("super8-images")
            .upload(fileName, file);

        if (uploadError) {
            console.error(uploadError);
            continue;
        }

        const { data } = supabaseClient
            .storage
            .from("super8-images")
            .getPublicUrl(fileName);

        rows.push({
            product_id: productId,
            image_url: data.publicUrl
        });
    }

    if (rows.length > 0) {

        const { error } = await supabaseClient
            .from("product_images")
            .insert(rows);

        if (error) {
            console.error(
                "Error guardando imágenes:",
                error
            );
        }
    }
}


/* =========================
   MOSTRAR IMÁGENES ACTUALES DEL PRODUCTO
========================= */

async function loadProductImagesPreview(productId, mainImage) {

    const currentImagePreview = document.getElementById("currentImagePreview");

    if (!currentImagePreview) return;

    const { data, error } = await supabaseClient
        .from("product_images")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Error cargando imágenes del producto:", error);
        return;
    }

    const images = data && data.length > 0
        ? data.map(img => img.image_url)
        : (mainImage ? [mainImage] : []);

    if(images.length === 0){

        currentImagePreview.innerHTML = `
            <p>Este producto no tiene imágenes.</p>
        `;

    }else{

        currentImagePreview.innerHTML = `
            <p>Imágenes actuales:</p>

            <div class="current-images-grid">
                ${images.map(image => `
                    <img src="${image}" alt="Imagen del producto">
                `).join("")}
            </div>
        `;
}
}


/* =========================
   IMÁGENES MINI CARRUSEL ADMIN
========================= */

async function getAdminProductImages(productId, mainImage){

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

function moveAdminSmartCarousel(carouselId, direction){

  const carousel = document.getElementById(carouselId);

  if(!carousel) return;

  const image = carousel.querySelector("img");

  if(!image) return;

  const imageWidth = image.offsetWidth;

  const currentIndex =
    Math.round(carousel.scrollLeft / imageWidth);

  const totalImages =
    carousel.querySelectorAll("img").length;

  let newIndex = currentIndex + direction;

  if(newIndex < 0){
    newIndex = 0;
  }

  if(newIndex > totalImages - 1){
    newIndex = totalImages - 1;
  }

  carousel.scrollTo({
    left:imageWidth * newIndex,
    behavior:"smooth"
  });

  setTimeout(() => {
    updateAdminCarouselButtons(carouselId);
  }, 350);
}

function updateAdminCarouselButtons(carouselId){

  const carousel =
    document.getElementById(carouselId);

  if(!carousel) return;

  const wrapper =
    carousel.closest(".admin-mini-carousel");

  if(!wrapper) return;

  const prevBtn =
    wrapper.querySelector(".admin-carousel-btn.prev");

  const nextBtn =
    wrapper.querySelector(".admin-carousel-btn.next");

  const image =
    carousel.querySelector("img");

  if(!image) return;

  const imageWidth = image.offsetWidth;

  const currentIndex =
    Math.round(carousel.scrollLeft / imageWidth);

  const totalImages =
    carousel.querySelectorAll("img").length;

  if(prevBtn){
    prevBtn.classList.toggle(
      "hidden-carousel-btn",
      currentIndex === 0
    );
  }

  if(nextBtn){
    nextBtn.classList.toggle(
      "hidden-carousel-btn",
      currentIndex >= totalImages - 1
    );
  }
}


const newMainCategoryBtn =
  document.getElementById("newMainCategoryBtn");

const newSubcategoryBtn =
  document.getElementById("newSubcategoryBtn");

const parentCategoryWrapper =
  document.getElementById("parentCategoryWrapper");

if(newMainCategoryBtn){

  newMainCategoryBtn.addEventListener("click", () => {

    parentCategoryWrapper.style.display = "none";

    document.getElementById("categoryParent").value = "";
    document.getElementById("showHomeWrapper").style.display =
        "block";

    document.getElementById("categoryName").placeholder =
      "Ej. Jarcería";

    document.querySelector('label[for="categoryName"]');


    document.getElementById("categoryNameLabel").textContent =
        "Nombre de categoría";

        document.getElementById("categoryName").placeholder =
        "Ej. Jarcería";
  });

}

if(newSubcategoryBtn && parentCategoryWrapper){

  newSubcategoryBtn.addEventListener("click", () => {

    parentCategoryWrapper.style.display = "block";

    document.getElementById("categoryNameLabel").textContent =
      "Nombre de subcategoría";

    document.getElementById("categoryName").placeholder =
      "Ej. Escobas";

    document.getElementById("showHomeWrapper").style.display =
      "none";

    document.getElementById("categoryShowHome").checked =
      false;

  });

}


function setupAdminProductSearch(){

  const input =
    document.getElementById("adminProductSearch");

  if(!input) return;

  input.addEventListener("input", () => {

    const search =
      input.value.toLowerCase().trim();

    const cards =
      document.querySelectorAll(".admin-product-item");

    cards.forEach(card => {

      const text =
        card.textContent.toLowerCase();

      card.style.display =
        text.includes(search) ? "" : "none";

    });

    const subcategories =
      document.querySelectorAll(".admin-products-subcategory");

    subcategories.forEach(subcategory => {

      let next =
        subcategory.nextElementSibling;

      let hasVisibleProduct = false;

      while(
        next &&
        !next.classList.contains("admin-products-subcategory") &&
        !next.classList.contains("admin-products-category")
      ){

        if(
          next.classList.contains("admin-product-item") &&
          next.style.display !== "none"
        ){
          hasVisibleProduct = true;
        }

        next = next.nextElementSibling;
      }

      subcategory.style.display =
        hasVisibleProduct ? "" : "none";

    });

    const categories =
      document.querySelectorAll(".admin-products-category");

    categories.forEach(category => {

      let next =
        category.nextElementSibling;

      let hasVisibleProduct = false;

      while(
        next &&
        !next.classList.contains("admin-products-category")
      ){

        if(
          next.classList.contains("admin-product-item") &&
          next.style.display !== "none"
        ){
          hasVisibleProduct = true;
        }

        next = next.nextElementSibling;
      }

      category.style.display =
        hasVisibleProduct ? "" : "none";

    });

  });

}


async function toggleProductNew(id, currentStatus){

  const { error } = await supabaseClient
    .from("products")
    .update({ is_new: !currentStatus })
    .eq("id", id);

  if(error){
    console.error(error);
    alert("No se pudo cambiar la etiqueta de nuevo.");
    return;
  }

  loadAdminProducts();
}

async function toggleProductOffer(id, currentStatus){

  const { error } = await supabaseClient
    .from("products")
    .update({ is_offer: !currentStatus })
    .eq("id", id);

  if(error){
    console.error(error);
    alert("No se pudo cambiar la etiqueta de oferta.");
    return;
  }

  loadAdminProducts();
}


function formatProductPrice(value){

  let cleanValue = value
    .replace(/MXN/gi, "")
    .replace(/\$/g, "")
    .trim();

  cleanValue = cleanValue.replace(/[^0-9.]/g, "");

  if(cleanValue === ""){
    return "";
  }

  const parts = cleanValue.split(".");

  let numberPart = parts[0] || "0";
  let decimalPart = parts[1];

  if(decimalPart === undefined){
    decimalPart = "00";
  }else{
    decimalPart = decimalPart.substring(0, 2).padEnd(2, "0");
  }

  return `$${numberPart}.${decimalPart} MXN`;
}


const productPriceInput =
  document.getElementById("productPrice");

if(productPriceInput){

  productPriceInput.addEventListener("blur", () => {

    productPriceInput.value =
      formatProductPrice(productPriceInput.value);

  });

}


async function loadProductAnalytics(){

  await loadAnalyticsByType(
    "product_view",
    "topViewedProducts"
  );

  await loadAnalyticsByType(
    "share_click",
    "topSharedProducts"
  );

  await loadAnalyticsByType(
    "image_zoom",
    "topZoomedProducts"
  );
}

async function loadAnalyticsByType(eventType, containerId){

  const container =
    document.getElementById(containerId);

  if(!container) return;

  const { data: analytics, error } = await supabaseClient
    .from("product_analytics")
    .select("product_id")
    .eq("event_type", eventType);

  if(error){
    console.error(error);
    container.innerHTML =
      "<p>Error al cargar estadísticas.</p>";
    return;
  }

  if(!analytics || analytics.length === 0){
    container.innerHTML =
      "<p>Sin datos todavía.</p>";
    return;
  }

  const counts = {};

  analytics.forEach(item => {
    counts[item.product_id] =
      (counts[item.product_id] || 0) + 1;
  });

  const productIds =
    Object.keys(counts).map(id => Number(id));

  const { data: products, error: productsError } = await supabaseClient
    .from("products")
    .select("id, name")
    .in("id", productIds);

  if(productsError){
    console.error(productsError);
    container.innerHTML =
      "<p>Error al cargar productos.</p>";
    return;
  }

  const productMap = {};

  products.forEach(product => {
    productMap[product.id] = product.name;
  });

  const sorted =
    Object.entries(counts)
      .filter(([productId]) => productMap[productId])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

  if(sorted.length === 0){
    container.innerHTML =
      "<p>Sin productos activos.</p>";
    return;
  }

  container.innerHTML = sorted.map(([productId, count]) => `
    <div class="analytics-item">
      <strong>${productMap[productId]}</strong>
      <span>${count}</span>
    </div>
  `).join("");
}




/* =========================
   LOGOUT
========================= */

const logoutBtn =
  document.getElementById("logoutBtn");

if(logoutBtn){

  logoutBtn.addEventListener("click", async () => {

    await supabaseClient.auth.signOut();

    window.location.href =
      "login.html";

  });

}


/* =========================
   INICIAR ADMIN SEGURO
========================= */

(async () => {

  const allowed =
    await checkAdminSession();

  if(!allowed) return;

  loadCategoriesAdmin();
  loadAdminProducts();
  loadCategoriesAdminList();
  loadAdminStats();
  loadAdminPromotions();
  loadStoresAdmin();
  loadProductAnalytics();

})();