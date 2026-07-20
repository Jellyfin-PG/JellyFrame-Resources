(function () {
    const STYLE_ID = 'jf-menu-anims';
    const CONTAINER_CLASS = 'jf-custom-menu-container';
    const CATEGORY_CLASS = 'jf-custom-menu-category';

    if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            .btnApplicationMenu, .btnHeaderMenu, .barsMenuButton, .btnCloseMenu { 
                transition: transform 0.2s ease !important; 
            } 
            .btnApplicationMenu:hover, .btnHeaderMenu:hover, .barsMenuButton:hover, .btnCloseMenu:hover { 
                transform: scale(1.15) !important; 
            } 
            .btnApplicationMenu:active, .btnHeaderMenu:active, .barsMenuButton:active, .btnCloseMenu:active { 
                transform: scale(0.9) !important; 
            } 
            .btnApplicationMenu .material-icons, .btnHeaderMenu .material-icons, .barsMenuButton .material-icons, .btnCloseMenu .material-icons { 
                transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1) !important; 
            } 
            .btnApplicationMenu:hover .material-icons, .btnHeaderMenu:hover .material-icons, .barsMenuButton:hover .material-icons, .btnCloseMenu:hover .material-icons { 
                transform: rotate(180deg) !important; 
            }
            .sidebarHeader.custom-sidebar-header {
                margin: 1.5em 0 0.5em 0 !important;
                padding: 0 12px !important;
                font-size: 11px !important;
                font-weight: 700 !important;
                text-transform: uppercase !important;
                letter-spacing: 1.2px !important;
                color: rgba(255, 255, 255, 0.4) !important;
            }
            .mainDrawer-scrollContainer .sidebarHeader.custom-sidebar-header {
                padding: 0 16px !important;
                margin: 1.2em 0 0.4em 0 !important;
            }
            .${CONTAINER_CLASS} {
                display: flex !important;
                flex-direction: column !important;
                width: 100% !important;
            }
        `;
        document.head.appendChild(style);
    }

    const registry = {
        categories: {
            general: {
                id: 'general',
                title: 'General',
                items: [
                    {
                        id: 'home',
                        text: 'Home',
                        selector: 'a[href="#/home"], a.lnkMediaFolder',
                        icon: 'home'
                    }
                ]
            }
        },
        categoryOrder: ['general']
    };

    function safeCreateElement(tagName, isMobile) {
        if (tagName === 'a') {
            const anchor = document.createElement('a');
            if (isMobile) {
                anchor.className = 'sidebarLink custom-menu-item';
                anchor.style.setProperty('display', 'flex', 'important');
                anchor.style.setProperty('align-items', 'center', 'important');
                anchor.style.setProperty('gap', '12px', 'important');
            } else {
                anchor.className = 'navMenuOption emby-button custom-menu-item';
            }
            return anchor;
        }
        return document.createElement(tagName);
    }

    function renderCategoryTo(container, catId, isMobile) {
        const cat = registry.categories[catId];
        if (!cat || !cat.items || cat.items.length === 0) return;

        const catDiv = document.createElement('div');
        catDiv.className = CATEGORY_CLASS;
        catDiv.setAttribute('data-category-id', catId);

        const header = document.createElement('h3');
        header.className = 'sidebarHeader custom-sidebar-header';
        header.textContent = cat.title;
        catDiv.appendChild(header);

        cat.items.forEach(function (item) {
            let element = null;

            if (item.selector) {
                const target = document.querySelector(item.selector);
                if (target) {
                    element = target;
                }
            }

            if (!element) {
                element = safeCreateElement('a', isMobile);
                element.setAttribute('data-item-id', item.id);
                if (item.href) element.href = item.href;

                const iconSpan = document.createElement('span');
                iconSpan.className = isMobile ? 'material-icons sidebarLinkIcon' : 'material-icons navMenuOptionIcon';
                if (isMobile) iconSpan.style.fontSize = '20px';
                iconSpan.textContent = item.icon || 'star';

                const textSpan = document.createElement('span');
                textSpan.className = isMobile ? 'sidebarLinkText' : 'navMenuOptionText';
                textSpan.textContent = item.text;

                element.appendChild(iconSpan);
                element.appendChild(textSpan);

                if (item.onClick) {
                    element.addEventListener('click', item.onClick);
                }
            }

            catDiv.appendChild(element);
        });

        container.appendChild(catDiv);
    }

    function renderMenuTo(parentContainer, isMobile) {
        let menuContainer = parentContainer.querySelector('.' + CONTAINER_CLASS);
        if (menuContainer) {
            menuContainer.innerHTML = '';
        } else {
            menuContainer = document.createElement('div');
            menuContainer.className = CONTAINER_CLASS;
            parentContainer.appendChild(menuContainer);
        }

        registry.categoryOrder.forEach(function (catId) {
            renderCategoryTo(menuContainer, catId, isMobile);
        });
    }

    const r = function () {
        const desktopMenu = document.querySelector(".customMenuOptions");
        const mobileMenu = document.querySelector(".mainDrawer-scrollContainer");

        if (desktopMenu) {
            renderMenuTo(desktopMenu, false);
        }

        if (mobileMenu) {
            if (!document.querySelector(".btnCloseMenuContainer")) {
                const closeContainer = document.createElement("div");
                closeContainer.className = "btnCloseMenuContainer";
                closeContainer.style.display = "flex";
                closeContainer.style.justifyContent = "flex-end";
                closeContainer.style.padding = "8px 16px 0 0";

                const closeButton = document.createElement("button");
                closeButton.type = "button";
                closeButton.setAttribute("is", "paper-icon-button-light");
                closeButton.className = "headerButton mainDrawerButton barsMenuButton headerButtonLeft paper-icon-button-light btnCloseMenu";
                closeButton.title = "Close Menu";
                closeButton.innerHTML = '<span class="material-icons" aria-hidden="true">close</span>';

                closeButton.addEventListener("click", function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const backdrop = document.querySelector(".mainDrawer-backdrop, .drawer-backdrop");
                    if (backdrop) {
                        backdrop.click();
                        return;
                    }
                    const altButton = document.querySelector(".btnApplicationMenu, .btnHeaderMenu, .mainDrawerButton:not(.btnCloseMenu)");
                    if (altButton) altButton.click();
                });

                closeContainer.appendChild(closeButton);
                mobileMenu.insertBefore(closeContainer, mobileMenu.firstChild);
            }

            renderMenuTo(mobileMenu, true);
        }
    };

    const customMenuAPI = {
        createCategory: function (id, title, positionIndex) {
            if (registry.categories[id]) return;
            registry.categories[id] = { id: id, title: title, items: [] };
            if (typeof positionIndex === 'number' && positionIndex >= 0) {
                registry.categoryOrder.splice(positionIndex, 0, id);
            } else {
                registry.categoryOrder.push(id);
            }
            r();
        },
        addMenuItem: function (categoryId, itemOptions) {
            const cat = registry.categories[categoryId];
            if (!cat) return;
            const newItem = {
                id: itemOptions.id || ('item_' + Date.now()),
                text: itemOptions.text || 'Item',
                href: itemOptions.href || '#',
                icon: itemOptions.icon || 'star',
                selector: itemOptions.selector || null,
                onClick: itemOptions.onClick || null
            };
            if (typeof itemOptions.positionIndex === 'number' && itemOptions.positionIndex >= 0) {
                cat.items.splice(itemOptions.positionIndex, 0, newItem);
            } else {
                cat.items.push(newItem);
            }
            r();
        },
        reorderItems: function (categoryId, sortedIds) {
            const cat = registry.categories[categoryId];
            if (!cat) return;
            const reordered = [];
            sortedIds.forEach(function (id) {
                const found = cat.items.find(function (item) { return item.id === id; });
                if (found) reordered.push(found);
            });
            cat.items.forEach(function (item) {
                if (!reordered.includes(item)) reordered.push(item);
            });
            cat.items = reordered;
            r();
        },
        reorderCategories: function (sortedCategoryIds) {
            const validIds = sortedCategoryIds.filter(function (id) { return registry.categories[id]; });
            registry.categoryOrder.forEach(function (id) {
                if (!validIds.includes(id)) validIds.push(id);
            });
            registry.categoryOrder = validIds;
            r();
        }
    };

    const bindAPI = function () {
        const client = window.ApiClient || window.apiClient || {};
        client.customMenu = customMenuAPI;
        window.ApiClient = client;
    };

    bindAPI();
    r();

    const observer = new MutationObserver(function (mutations) {
        for (let i = 0; i < mutations.length; i++) {
            const added = mutations[i].addedNodes;
            for (let j = 0; j < added.length; j++) {
                const node = added[j];
                if (node.nodeType === 1) {
                    if (node.classList.contains("mainDrawer-scrollContainer") || 
                        node.classList.contains("customMenuOptions") || 
                        node.querySelector(".customMenuOptions")) {
                        bindAPI();
                        r();
                        return;
                    }
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
