// meilisearch-sync - browser.js
// Intercepts Jellyfin's search page and replaces results with Meilisearch output.
// No const/let, no arrow functions, no template literals, no non-ASCII chars, always braces.

(function() {
    if (window.__jellyframeMsLoaded) { return; }
    window.__jellyframeMsLoaded = true;

    var MOD_API = '/JellyFrame/mods/meilisearch-sync/api';
    var currentQuery = '';
    var debounceTimer = null;
    var overlayEl = null;
    var inputObserver = null;

    var TYPE_LABEL = {
        'Movie':      'Movie',
        'Series':     'Series',
        'Episode':    'Episode',
        'Audio':      'Song',
        'MusicAlbum': 'Album',
        'Book':       'Book'
    };

    var TYPE_COLOR = {
        'Movie':      '#00a4dc',
        'Series':     '#aa5cc3',
        'Episode':    '#aa5cc3',
        'Audio':      '#1db954',
        'MusicAlbum': '#1db954',
        'Book':       '#e8a045'
    };

    var style = document.createElement('style');
    style.textContent = [
        '#ms-overlay{',
            'display:none;',
            'position:fixed;',
            'top:0;left:0;right:0;bottom:0;',
            'z-index:99999;',
            'background:rgba(10,10,15,0.92);',
            'backdrop-filter:blur(8px);',
            '-webkit-backdrop-filter:blur(8px);',
            'font-family:"Segoe UI",system-ui,sans-serif;',
        '}',
        '#ms-overlay.ms-visible{display:flex;flex-direction:column;}',
        '#ms-header{',
            'display:flex;align-items:center;gap:16px;',
            'padding:20px 32px 16px;',
            'border-bottom:1px solid rgba(255,255,255,0.08);',
            'flex-shrink:0;',
        '}',
        '#ms-search-wrap{',
            'flex:1;display:flex;align-items:center;',
            'background:rgba(255,255,255,0.06);',
            'border:1px solid rgba(255,255,255,0.12);',
            'border-radius:10px;',
            'padding:0 16px;',
            'gap:10px;',
        '}',
        '#ms-icon{color:rgba(255,255,255,0.4);font-size:20px;flex-shrink:0;}',
        '#ms-input{',
            'flex:1;background:transparent;border:none;outline:none;',
            'color:#fff;font-size:18px;padding:12px 0;',
            'font-family:inherit;',
        '}',
        '#ms-close{',
            'background:none;border:none;cursor:pointer;',
            'color:rgba(255,255,255,0.5);font-size:22px;',
            'padding:8px;border-radius:6px;flex-shrink:0;',
            'transition:color 0.15s;',
        '}',
        '#ms-close:hover{color:#fff;}',
        '#ms-meta{',
            'padding:8px 32px;',
            'font-size:12px;color:rgba(255,255,255,0.35);',
            'flex-shrink:0;',
        '}',
        '#ms-results{',
            'flex:1;overflow-y:auto;',
            'padding:8px 32px 32px;',
            'display:grid;',
            'grid-template-columns:repeat(auto-fill,minmax(160px,1fr));',
            'gap:16px;',
            'align-content:start;',
        '}',
        '#ms-results.ms-list{',
            'grid-template-columns:1fr;',
            'gap:4px;',
        '}',
        '.ms-card{',
            'background:rgba(255,255,255,0.04);',
            'border:1px solid rgba(255,255,255,0.07);',
            'border-radius:10px;',
            'overflow:hidden;',
            'cursor:pointer;',
            'transition:transform 0.15s,border-color 0.15s,background 0.15s;',
            'display:flex;flex-direction:column;',
        '}',
        '.ms-card:hover{',
            'transform:translateY(-2px);',
            'border-color:rgba(255,255,255,0.2);',
            'background:rgba(255,255,255,0.08);',
        '}',
        '.ms-thumb{',
            'width:100%;aspect-ratio:2/3;',
            'object-fit:cover;background:#1a1a2e;',
            'flex-shrink:0;',
        '}',
        '.ms-thumb-placeholder{',
            'width:100%;aspect-ratio:2/3;',
            'background:linear-gradient(135deg,#1a1a2e,#16213e);',
            'display:flex;align-items:center;justify-content:center;',
            'color:rgba(255,255,255,0.15);font-size:32px;',
        '}',
        '.ms-card-body{padding:10px;flex:1;}',
        '.ms-card-name{',
            'font-size:13px;font-weight:600;',
            'color:#fff;margin:0 0 4px;',
            'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
        '}',
        '.ms-card-sub{',
            'font-size:11px;color:rgba(255,255,255,0.45);',
            'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
        '}',
        '.ms-type-badge{',
            'display:inline-block;',
            'font-size:10px;font-weight:700;letter-spacing:0.05em;',
            'padding:2px 6px;border-radius:4px;',
            'margin-bottom:5px;',
            'text-transform:uppercase;',
        '}',
        '.ms-empty{',
            'grid-column:1/-1;',
            'text-align:center;padding:80px 0;',
            'color:rgba(255,255,255,0.3);',
            'font-size:16px;',
        '}',
        '.ms-spinner{',
            'grid-column:1/-1;',
            'text-align:center;padding:80px 0;',
            'color:rgba(255,255,255,0.3);',
            'font-size:13px;',
        '}',
        '#ms-footer{',
            'padding:10px 32px;',
            'border-top:1px solid rgba(255,255,255,0.06);',
            'font-size:11px;color:rgba(255,255,255,0.2);',
            'display:flex;justify-content:space-between;',
            'flex-shrink:0;',
        '}'
    ].join('');
    document.head.appendChild(style);

    function buildOverlay() {
        var el = document.createElement('div');
        el.id = 'ms-overlay';
        el.innerHTML = [
            '<div id="ms-header">',
                '<div id="ms-search-wrap">',
                    '<span id="ms-icon" class="material-icons">search</span>',
                    '<input id="ms-input" type="text" placeholder="Search your library..." autocomplete="off" spellcheck="false" />',
                '</div>',
                '<button id="ms-close" title="Close (Esc)"><span class="material-icons" style="font-size:20px;vertical-align:middle;">close</span></button>',
            '</div>',
            '<div id="ms-meta"></div>',
            '<div id="ms-results"></div>',
            '<div id="ms-footer">',
                '<span>Powered by Meilisearch</span>',
                '<span id="ms-timing"></span>',
            '</div>'
        ].join('');
        document.body.appendChild(el);

        document.getElementById('ms-close').onclick = function() { hideOverlay(); };
        document.getElementById('ms-input').oninput = function(e) { onInput(e.target.value); };

        el.addEventListener('click', function(e) {
            if (e.target === el) { hideOverlay(); }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') { hideOverlay(); }
        });

        return el;
    }

    function showOverlay(query) {
        if (!overlayEl) { overlayEl = buildOverlay(); }
        overlayEl.classList.add('ms-visible');
        var input = document.getElementById('ms-input');
        input.value = query || '';
        input.focus();
        if (query) { doSearch(query); }
    }

    function hideOverlay() {
        if (!overlayEl) { return; }
        overlayEl.classList.remove('ms-visible');
        currentQuery = '';
    }

    function onInput(val) {
        currentQuery = val;
        clearTimeout(debounceTimer);
        if (!val || val.trim().length === 0) {
            document.getElementById('ms-results').innerHTML = '';
            document.getElementById('ms-meta').textContent = '';
            return;
        }
        debounceTimer = setTimeout(function() { doSearch(val); }, 220);
    }

    function doSearch(q) {
        var resultsEl = document.getElementById('ms-results');
        resultsEl.innerHTML = '<div class="ms-spinner">Searching...</div>';

        var url = MOD_API + '/search?q=' + encodeURIComponent(q) + '&limit=40';
        var start = Date.now();

        ApiClient.ajax({ url: url, type: 'GET', dataType: 'json' }).then(function(data) {
            var elapsed = Date.now() - start;
            if (q !== currentQuery) { return; } // stale response
            renderResults(data, elapsed);
        }).catch(function() {
            if (q !== currentQuery) { return; }
            resultsEl.innerHTML = '<div class="ms-empty">Search unavailable. Check Meilisearch connection.</div>';
        });
    }

    function renderResults(data, elapsed) {
        var hits = (data && data.hits) ? data.hits : [];
        var total = (data && data.estimatedTotalHits) ? data.estimatedTotalHits : hits.length;
        var resultsEl = document.getElementById('ms-results');
        var metaEl = document.getElementById('ms-meta');
        var timingEl = document.getElementById('ms-timing');

        metaEl.textContent = total === 0 ? 'No results' : (total + ' result' + (total !== 1 ? 's' : ''));
        timingEl.textContent = elapsed + 'ms';

        if (hits.length === 0) {
            resultsEl.innerHTML = '<div class="ms-empty">No results for &ldquo;' + escHtml(currentQuery) + '&rdquo;</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < hits.length; i++) {
            html += buildCard(hits[i]);
        }
        resultsEl.innerHTML = html;

        // Attach click handlers
        var cards = resultsEl.querySelectorAll('.ms-card');
        for (var j = 0; j < cards.length; j++) {
            (function(card) {
                card.onclick = function() { navigateToItem(card.getAttribute('data-id'), card.getAttribute('data-type')); };
            })(cards[j]);
        }
    }

    function buildCard(hit) {
        var typeLabel = TYPE_LABEL[hit.type] || hit.type || 'Item';
        var typeColor = TYPE_COLOR[hit.type] || '#888';
        var imgUrl = hit.primaryTag
            ? ('/Items/' + hit.id + '/Images/Primary?tag=' + hit.primaryTag + '&quality=80&maxWidth=200')
            : null;

        var thumbHtml = imgUrl
            ? ('<img class="ms-thumb" src="' + escAttr(imgUrl) + '" alt="" loading="lazy" />')
            : ('<div class="ms-thumb-placeholder">&#9654;</div>');

        var sub = '';
        if (hit.type === 'Episode' && hit.seriesName) {
            sub = escHtml(hit.seriesName);
            if (hit.seasonName) { sub += ' - ' + escHtml(hit.seasonName); }
        } else if (hit.type === 'Audio' && hit.seriesName) {
            sub = escHtml(hit.seriesName); // album name stored in seriesName for audio
        } else if (hit.year) {
            sub = String(hit.year);
        }

        return [
            '<div class="ms-card" data-id="' + escAttr(hit.id) + '" data-type="' + escAttr(hit.type) + '">',
                thumbHtml,
                '<div class="ms-card-body">',
                    '<div class="ms-type-badge" style="background:' + typeColor + '22;color:' + typeColor + ';">' + escHtml(typeLabel) + '</div>',
                    '<div class="ms-card-name">' + escHtml(hit.name || '') + '</div>',
                    sub ? '<div class="ms-card-sub">' + sub + '</div>' : '',
                '</div>',
            '</div>'
        ].join('');
    }

    function navigateToItem(id, type) {
        hideOverlay();
        if (!id) { return; }
        var userId = ApiClient.getCurrentUserId();
        // Use Jellyfin's internal router
        if (window.Emby && Emby.Page) {
            Emby.Page.show('/details?id=' + id + '&serverId=' + ApiClient.serverId());
        } else {
            window.location.hash = '#!/details?id=' + id + '&serverId=' + ApiClient.serverId();
        }
    }

    // Strategy: watch for the search input appearing in the header and intercept its focus/input.
    function interceptSearch() {
        // Jellyfin search input selector (works across Jellyfin 10.9+/10.10+/10.11+)
        var selectors = [
            '.headerSearchInput',
            'input[data-role="search"]',
            '.searchfields-txtSearch',
            '#headerSearchInput'
        ];

        function tryAttach() {
            var input = null;
            for (var i = 0; i < selectors.length; i++) {
                input = document.querySelector(selectors[i]);
                if (input) { break; }
            }
            if (!input || input.__msHooked) { return; }
            input.__msHooked = true;

            input.addEventListener('focus', function() {
                var val = input.value || '';
                showOverlay(val);
                // Blur the native input so it doesn't keep focus
                setTimeout(function() { input.blur(); }, 50);
            });

            input.addEventListener('input', function() {
                if (overlayEl && overlayEl.classList.contains('ms-visible')) {
                    document.getElementById('ms-input').value = input.value;
                    onInput(input.value);
                }
            });
        }

        // Also intercept the search button/icon click
        function tryAttachButton() {
            var btns = document.querySelectorAll('.headerSearchButton,.btnSearch,[data-action="search"]');
            for (var i = 0; i < btns.length; i++) {
                if (btns[i].__msHooked) { continue; }
                btns[i].__msHooked = true;
                btns[i].addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    showOverlay('');
                });
            }
        }

        tryAttach();
        tryAttachButton();
    }

    // MutationObserver to catch dynamic DOM (Jellyfin is a SPA)
    var observer = new MutationObserver(function() {
        interceptSearch();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Also try immediately and on route changes
    interceptSearch();
    document.addEventListener('viewshow', function() { interceptSearch(); });

    // Keyboard shortcut: Ctrl+K or Cmd+K opens search
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            showOverlay('');
        }
    });

    function escHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function escAttr(str) {
        return String(str || '').replace(/"/g, '&quot;');
    }

})();
