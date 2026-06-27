(() => {
    'use strict';

    // ─── STORAGE ──────────────────────────────────────────────────────────────
    const STORAGE_KEY = 'stockapp_inventory';

    const defaultData = [
        {
            category: "Bahan Pokok",
            items: [
                { name: "Beras Putih",   stock: 5,   opened: 2   },
                { name: "Minyak Goreng", stock: 0,   opened: 0   },
                { name: "Gula Pasir",    stock: 2,   opened: 0.5 }
            ]
        },
        {
            category: "Bumbu Dapur",
            items: [
                { name: "Garam",        stock: 3, opened: 1   },
                { name: "Kecap Manis",  stock: 2, opened: 1   },
                { name: "Saus Sambal",  stock: 1, opened: 1   },
                { name: "Bawang Merah", stock: 1, opened: 0.2 }
            ]
        },
        {
            category: "Peralatan Mandi",
            items: [
                { name: "Sabun Cair", stock: 3, opened: 1 },
                { name: "Sampo",      stock: 2, opened: 1 },
                { name: "Pasta Gigi", stock: 4, opened: 1 }
            ]
        },
        {
            category: "Alat Kebersihan",
            items: [
                { name: "Sabun Cuci Piring", stock: 2, opened: 1 },
                { name: "Deterjen",           stock: 3, opened: 1 }
            ]
        }
    ];

    function loadData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(defaultData));
        } catch {
            return JSON.parse(JSON.stringify(defaultData));
        }
    }

    function saveData() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(inventoryData));
    }

    // ─── STATE ────────────────────────────────────────────────────────────────
    let inventoryData = loadData();
    let currentSort = 'category';
    let sortDir     = 'asc';
    let searchQuery = '';
    let currentView = 'home'; // 'home' | 'settings'

    // ─── DOM REFS ─────────────────────────────────────────────────────────────
    const mainContainer       = document.getElementById('app-main');
    const addProductView      = document.getElementById('add-product-view');
    const settingsView        = document.getElementById('settings-view');
    const fabButton           = document.querySelector('.fab-button');
    const homeHeaderContent   = document.getElementById('home-header-content');
    const settingsHeaderContent = document.getElementById('settings-header-content');

    // Form
    const cancelAddBtn        = document.getElementById('cancelAddBtn');
    const confirmAddBtn       = document.getElementById('confirmAddBtn');
    const productNameInput    = document.getElementById('productName');
    const productCategoryInput= document.getElementById('productCategory');
    const productStockInput   = document.getElementById('productStock');
    const productOpenedInput  = document.getElementById('productOpened');
    const productUnitInput    = document.getElementById('productUnit');
    const categorySuggestions = document.getElementById('categorySuggestions');

    // Edit Modal
    const editProductModal    = document.getElementById('edit-product-modal');
    const editModalCloseBtn   = document.getElementById('edit-product-modal-close');
    const editProductName     = document.getElementById('editProductName');
    const editProductStock    = document.getElementById('editProductStock');
    const editProductOpened   = document.getElementById('editProductOpened');
    const confirmEditBtn      = document.getElementById('confirmEditBtn');
    let editState = { category: '', originalName: '' };

    // Sort
    const sortSelect          = document.getElementById('sortSelect');
    const sortDirBtn          = document.getElementById('sortDirBtn');

    // Search
    const searchContainer     = document.getElementById('search-container');
    const searchInput         = document.getElementById('searchInput');
    const clearSearchBtn      = document.getElementById('clearSearchBtn');

    // Settings buttons
    const exportBtn           = document.getElementById('exportBtn');
    const importBtn           = document.getElementById('importBtn');
    const importFileInput     = document.getElementById('importFileInput');
    const manageCategoryBtn   = document.getElementById('manageCategoryBtn');

    // Toast
    const toast               = document.getElementById('toast');

    // ─── TOAST ────────────────────────────────────────────────────────────────
    let toastTimer = null;
    function showToast(msg, type = 'success') {
        toast.textContent = msg;
        toast.className = `toast toast-${type} show`;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // ─── RENDER ───────────────────────────────────────────────────────────────
    function makeCard(item, categoryName, showCategory = false) {
        const card = document.createElement('div');
        card.className = item.stock === 0 ? 'product-card out-of-stock' : 'product-card';

        const catLabel = showCategory
            ? `<div class="product-category-label">${categoryName}</div>` : '';

        card.innerHTML = `
            <div class="product-name">
                ${escapeHtml(item.name)}
                ${catLabel}
            </div>
            <div class="product-qty">${item.stock}</div>
            <div class="product-qty">${item.opened}</div>
            <button class="product-delete-btn" aria-label="Delete product">
                <i class='bx bx-trash'></i>
            </button>
        `;
        
        card.addEventListener('click', () => {
            showEditModal(categoryName, item.name);
        });
        
        const deleteBtn = card.querySelector('.product-delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Hapus produk "${item.name}"?`)) {
                const group = inventoryData.find(g => g.category.toLowerCase() === categoryName.toLowerCase());
                if (group) {
                    const index = group.items.findIndex(i => i.name === item.name);
                    if (index > -1) {
                        group.items.splice(index, 1);
                        if (group.items.length === 0) {
                            const gIndex = inventoryData.indexOf(group);
                            inventoryData.splice(gIndex, 1);
                        }
                        saveData();
                        renderInventory();
                        showToast(`Produk "${item.name}" dihapus.`);
                    }
                }
            }
        });

        return card;
    }

    function renderInventory() {
        mainContainer.innerHTML = '';

        // Filter
        let dataToRender = inventoryData;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            dataToRender = inventoryData.map(group => {
                if (group.category.toLowerCase().includes(q)) return group;
                const filtered = group.items.filter(i => i.name.toLowerCase().includes(q));
                return { ...group, items: filtered };
            }).filter(g => g.items.length > 0);
        }

        if (dataToRender.length === 0) {
            mainContainer.innerHTML = `
                <div class="empty-state">
                    <i class='bx bx-box'></i>
                    <p>No items found</p>
                </div>`;
            return;
        }

        if (currentSort === 'category') {
            dataToRender.forEach((group, gi) => {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'category-group';
                groupDiv.style.animationDelay = `${gi * 0.07}s`;

                const divider = document.createElement('div');
                divider.className = 'category-divider';
                divider.innerHTML = `
                    <span class="line"></span>
                    <span class="category-name">${escapeHtml(group.category)}</span>
                    <span class="line"></span>`;
                groupDiv.appendChild(divider);

                group.items.forEach(item => {
                    groupDiv.appendChild(makeCard(item, group.category, false));
                });

                mainContainer.appendChild(groupDiv);
            });
        } else {
            // Flatten
            let flat = [];
            dataToRender.forEach(group => {
                group.items.forEach(item => flat.push({ ...item, categoryName: group.category }));
            });

            flat.sort((a, b) => {
                let r = 0;
                if      (currentSort === 'name')   r = a.name.localeCompare(b.name);
                else if (currentSort === 'stock')  r = a.stock  - b.stock;
                else if (currentSort === 'opened') r = a.opened - b.opened;
                return sortDir === 'asc' ? r : -r;
            });

            const groupDiv = document.createElement('div');
            groupDiv.className = 'category-group';
            flat.forEach(item => groupDiv.appendChild(makeCard(item, item.categoryName, true)));
            mainContainer.appendChild(groupDiv);
        }
    }

    // ─── SORT ─────────────────────────────────────────────────────────────────
    sortSelect.addEventListener('change', e => {
        currentSort = e.target.value;
        renderInventory();
    });

    sortDirBtn.addEventListener('click', () => {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
        sortDirBtn.innerHTML = sortDir === 'asc'
            ? "<i class='bx bx-sort-up'></i>"
            : "<i class='bx bx-sort-down'></i>";
        renderInventory();
    });

    // ─── SEARCH ───────────────────────────────────────────────────────────────
    searchInput.addEventListener('input', e => {
        searchQuery = e.target.value.trim();
        clearSearchBtn.style.display = searchQuery ? 'flex' : 'none';
        renderInventory();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        searchInput.focus();
        renderInventory();
    });

    // ─── NAVIGATION ───────────────────────────────────────────────────────────
    const navItems = document.querySelectorAll('.nav-item');

    function switchToHome() {
        currentView = 'home';
        addProductView.style.display = 'none';
        settingsView.style.display   = 'none';
        mainContainer.style.display  = 'block';
        searchContainer.style.display = 'none';
        fabButton.style.display      = 'flex';
        homeHeaderContent.style.display    = 'block';
        settingsHeaderContent.style.display = 'none';
        searchQuery = '';
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        navItems[0].classList.add('active');
        navItems[1].classList.remove('active');
        navItems[2].classList.remove('active');
        renderInventory();
    }

    navItems.forEach((item, index) => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            if (index === 0) { // Beranda
                currentView = 'home';
                settingsView.style.display   = 'none';
                mainContainer.style.display  = 'block';
                addProductView.style.display = 'none';
                searchContainer.style.display = 'none';
                fabButton.style.display      = 'flex';
                homeHeaderContent.style.display    = 'block';
                settingsHeaderContent.style.display = 'none';
                searchQuery = '';
                searchInput.value = '';
                clearSearchBtn.style.display = 'none';
                renderInventory();
            } else if (index === 1) { // Cari
                currentView = 'search';
                settingsView.style.display   = 'none';
                mainContainer.style.display  = 'block';
                addProductView.style.display = 'none';
                searchContainer.style.display = 'block';
                fabButton.style.display      = 'flex';
                homeHeaderContent.style.display    = 'block';
                settingsHeaderContent.style.display = 'none';
                setTimeout(() => searchInput.focus(), 100);
            } else if (index === 2) { // Pengaturan
                currentView = 'settings';
                mainContainer.style.display  = 'none';
                addProductView.style.display = 'none';
                searchContainer.style.display = 'none';
                fabButton.style.display      = 'none';
                settingsView.style.display   = 'block';
                homeHeaderContent.style.display    = 'none';
                settingsHeaderContent.style.display = 'block';
            }
        });
    });

    // ─── ADD PRODUCT ──────────────────────────────────────────────────────────
    function showAddView() {
        mainContainer.style.display  = 'none';
        addProductView.style.display = 'block';
        fabButton.style.display      = 'none';
        productNameInput.value     = '';
        productCategoryInput.value = '';
        productStockInput.value    = '';
        productOpenedInput.value   = '';
        categorySuggestions.style.display = 'none';
        productNameInput.focus();
    }

    function hideAddView() {
        addProductView.style.display = 'none';
        mainContainer.style.display  = 'block';
        fabButton.style.display      = 'flex';
    }

    fabButton.addEventListener('click', showAddView);
    cancelAddBtn.addEventListener('click', hideAddView);

    // Category autocomplete
    productCategoryInput.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        categorySuggestions.innerHTML = '';
        if (!q) { categorySuggestions.style.display = 'none'; return; }

        const cats = inventoryData.map(g => g.category);
        const matches = cats.filter(c => c.toLowerCase().includes(q));

        if (matches.length > 0) {
            matches.forEach(m => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.textContent = m;
                div.addEventListener('click', () => {
                    productCategoryInput.value = m;
                    categorySuggestions.style.display = 'none';
                });
                categorySuggestions.appendChild(div);
            });
        } else {
            const div = document.createElement('div');
            div.className = 'suggestion-item create-new';
            div.textContent = `+ Create: "${e.target.value}"`;
            div.addEventListener('click', () => {
                categorySuggestions.style.display = 'none';
            });
            categorySuggestions.appendChild(div);
        }
        categorySuggestions.style.display = 'block';
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-group')) {
            categorySuggestions.style.display = 'none';
        }
    });

    confirmAddBtn.addEventListener('click', () => {
        const name     = productNameInput.value.trim();
        const category = productCategoryInput.value.trim();
        const stock    = parseFloat(productStockInput.value) || 0;
        const opened   = parseFloat(productOpenedInput.value) || 0;

        if (!name || !category) {
            showToast('Please fill in Name and Category!', 'error');
            return;
        }

        const newItem = { name, stock, opened };
        const idx = inventoryData.findIndex(g => g.category.toLowerCase() === category.toLowerCase());

        if (idx >= 0) {
            inventoryData[idx].items.push(newItem);
        } else {
            inventoryData.push({ category, items: [newItem] });
        }

        saveData();
        renderInventory();
        hideAddView();
        showToast(`"${name}" added!`);
    });

    // ─── EDIT PRODUCT ─────────────────────────────────────────────────────────
    function showEditModal(category, name) {
        const group = inventoryData.find(g => g.category.toLowerCase() === category.toLowerCase());
        if (!group) return;
        const item = group.items.find(i => i.name === name);
        if (!item) return;

        editState.category = group.category;
        editState.originalName = name;

        editProductName.value = item.name;
        editProductStock.value = item.stock;
        editProductOpened.value = item.opened;

        editProductModal.classList.add('open');
    }

    function hideEditModal() {
        editProductModal.classList.remove('open');
    }

    editModalCloseBtn.addEventListener('click', hideEditModal);
    editProductModal.addEventListener('click', e => {
        if (e.target === editProductModal) hideEditModal();
    });

    confirmEditBtn.addEventListener('click', () => {
        const newName = editProductName.value.trim();
        const newStock = parseFloat(editProductStock.value) || 0;
        const newOpened = parseFloat(editProductOpened.value) || 0;

        if (!newName) {
            showToast('Nama produk tidak boleh kosong!', 'error');
            return;
        }

        const group = inventoryData.find(g => g.category === editState.category);
        if (!group) return;
        const item = group.items.find(i => i.name === editState.originalName);
        if (!item) return;

        if (newName.toLowerCase() !== editState.originalName.toLowerCase()) {
            const duplicate = group.items.find(i => i.name.toLowerCase() === newName.toLowerCase());
            if (duplicate) {
                showToast(`Produk "${newName}" sudah ada!`, 'error');
                return;
            }
        }

        item.name = newName;
        item.stock = newStock;
        item.opened = newOpened;

        saveData();
        renderInventory();
        hideEditModal();
        showToast(`"${newName}" berhasil diupdate!`);
    });

    // ─── EXPORT CSV ───────────────────────────────────────────────────────────
    exportBtn.addEventListener('click', () => {
        const rows = [['Category', 'Name', 'Stock', 'Opened']];

        inventoryData.forEach(group => {
            group.items.forEach(item => {
                rows.push([
                    csvEscape(group.category),
                    csvEscape(item.name),
                    item.stock,
                    item.opened
                ]);
            });
        });

        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `stock_export_${dateStamp()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Data exported as CSV!');
    });

    // ─── IMPORT CSV ───────────────────────────────────────────────────────────
    importBtn.addEventListener('click', () => importFileInput.click());

    importFileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const lines = ev.target.result.trim().split('\n');
                // Skip header row
                const dataLines = lines.slice(1);
                if (dataLines.length === 0) throw new Error('Empty file');

                const imported = [];

                dataLines.forEach(line => {
                    const parts = parseCSVLine(line);
                    if (parts.length < 4) return;
                    const [category, name, stock, opened] = parts;
                    if (!category || !name) return;

                    const newItem = {
                        name: name.trim(),
                        stock: parseFloat(stock) || 0,
                        opened: parseFloat(opened) || 0
                    };

                    const idx = imported.findIndex(g => g.category.toLowerCase() === category.trim().toLowerCase());
                    if (idx >= 0) {
                        imported[idx].items.push(newItem);
                    } else {
                        imported.push({ category: category.trim(), items: [newItem] });
                    }
                });

                if (imported.length === 0) throw new Error('No valid data found');

                // Confirm merge or replace
                const choice = confirm(`Found ${imported.reduce((acc, g) => acc + g.items.length, 0)} items in ${imported.length} categories.\n\nClick OK to REPLACE all data, or Cancel to MERGE with existing data.`);

                if (choice) {
                    // Replace
                    inventoryData = imported;
                } else {
                    // Merge
                    imported.forEach(impGroup => {
                        const existing = inventoryData.find(g => g.category.toLowerCase() === impGroup.category.toLowerCase());
                        if (existing) {
                            impGroup.items.forEach(newItem => {
                                const dup = existing.items.find(i => i.name.toLowerCase() === newItem.name.toLowerCase());
                                if (!dup) existing.items.push(newItem);
                            });
                        } else {
                            inventoryData.push(impGroup);
                        }
                    });
                }

                saveData();
                renderInventory();
                showToast('Data imported successfully!');
            } catch (err) {
                showToast(`Import failed: ${err.message}`, 'error');
            }

            // Reset input so same file can be imported again
            importFileInput.value = '';
        };
        reader.readAsText(file);
    });

    // ─── MANAGE CATEGORIES ────────────────────────────────────────────────────
    manageCategoryBtn.addEventListener('click', () => {
        showCategoryManager();
    });

    function showCategoryManager() {
        const modal = document.getElementById('category-modal');
        renderCategoryList();
        modal.classList.add('open');
    }

    function hideCategoryManager() {
        document.getElementById('category-modal').classList.remove('open');
    }

    document.getElementById('category-modal-close').addEventListener('click', hideCategoryManager);
    document.getElementById('category-modal').addEventListener('click', e => {
        if (e.target === document.getElementById('category-modal')) hideCategoryManager();
    });

    function renderCategoryList() {
        const list = document.getElementById('category-modal-list');
        list.innerHTML = '';
        if (inventoryData.length === 0) {
            list.innerHTML = '<p style="color: var(--text-secondary); text-align:center; padding: 16px;">No categories yet.</p>';
            return;
        }
        inventoryData.forEach((group, gi) => {
            const row = document.createElement('div');
            row.className = 'category-modal-row';
            row.innerHTML = `
                <div class="category-modal-info">
                    <span class="category-modal-name">${escapeHtml(group.category)}</span>
                    <span class="category-modal-count">${group.items.length} items</span>
                </div>
                <button class="cat-delete-btn" data-index="${gi}" aria-label="Delete category">
                    <i class='bx bx-trash'></i>
                </button>
            `;
            list.appendChild(row);
        });

        list.querySelectorAll('.cat-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const gi = parseInt(btn.dataset.index);
                const cat = inventoryData[gi].category;
                if (confirm(`Delete category "${cat}" and all ${inventoryData[gi].items.length} items?`)) {
                    inventoryData.splice(gi, 1);
                    saveData();
                    renderCategoryList();
                    renderInventory();
                    showToast(`Category "${cat}" deleted.`);
                }
            });
        });
    }

    // ─── HELPERS ──────────────────────────────────────────────────────────────
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function csvEscape(val) {
        const s = String(val);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
    }

    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
                else inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
        result.push(current);
        return result;
    }

    function dateStamp() {
        const d = new Date();
        return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    }

    // ─── INIT ─────────────────────────────────────────────────────────────────
    renderInventory();

})();
