// notify-dispatcher / browser.js
// Listens for JellyFrameNotification via Events.on(ApiClient, 'message', ...)
// Shows toast notifications and a bell icon history panel in the header.

(function() {

    var POSITION        = '{{POSITION}}';
    var MAX_TOASTS      = parseInt('{{MAX_TOASTS}}',      10) || 5;
    var DEFAULT_TIMEOUT = parseInt('{{DEFAULT_TIMEOUT}}', 10) || 5000;
    var MAX_HISTORY     = parseInt('{{MAX_HISTORY}}',     10) || 50;

    var notifHistory = [];
    var unreadCount  = 0;
    var nextId       = 0;

    function addToHistory(title, body, type) {
        var entry = {
            id:    ++nextId,
            title: title,
            body:  body,
            type:  type,
            time:  new Date(),
            read:  false
        };
        notifHistory.unshift(entry);
        if (notifHistory.length > MAX_HISTORY) {
            notifHistory.pop();
        }
        unreadCount++;
        updateBadge();
        if (panelOpen) {
            renderPanelItems();
        }
        return entry;
    }

    function markAllRead() {
        for (var i = 0; i < notifHistory.length; i++) {
            notifHistory[i].read = true;
        }
        unreadCount = 0;
        updateBadge();
    }

    function clearHistory() {
        notifHistory = [];
        unreadCount  = 0;
        updateBadge();
        if (panelOpen) {
            renderPanelItems();
        }
    }

    var COLORS = {
        info:    { accent: '#00a4dc', letter: 'i'  },
        success: { accent: '#4caf50', letter: 'ok' },
        warning: { accent: '#ff9800', letter: '!'  },
        error:   { accent: '#f44336', letter: 'x'  }
    };

    function col(type) {
        return COLORS[type] || COLORS.info;
    }

    function formatTime(date) {
        var now  = new Date();
        var diff = Math.floor((now - date) / 1000);
        if (diff < 5)    { return 'just now'; }
        if (diff < 60)   { return diff + 's ago'; }
        if (diff < 3600) { return Math.floor(diff / 60) + 'm ago'; }
        if (diff < 86400){ return Math.floor(diff / 3600) + 'h ago'; }
        return date.toLocaleDateString();
    }

    function waitForReady(cb) {
        if (typeof ApiClient !== 'undefined' &&
            typeof Events   !== 'undefined' &&
            ApiClient.getCurrentUserId) {
            cb();
        } else {
            setTimeout(function() { waitForReady(cb); }, 200);
        }
    }

    function getMyUserId() {
        try { return ApiClient.getCurrentUserId ? ApiClient.getCurrentUserId() : null; }
        catch (e) { return null; }
    }

    function getAuthToken() {
        try { return ApiClient._accessToken || ''; }
        catch (e) { return ''; }
    }

    var toastContainer = null;
    var activeToasts   = [];

    function getToastContainer() {
        if (toastContainer && document.body.contains(toastContainer)) {
            return toastContainer;
        }
        toastContainer = document.createElement('div');
        toastContainer.id = 'jf-notify-toasts';

        var isBottom = POSITION.indexOf('bottom') !== -1;
        var isLeft   = POSITION.indexOf('left')   !== -1;

        toastContainer.style.cssText = [
            'position:fixed',
            isBottom ? 'bottom:20px' : 'top:72px',
            isLeft   ? 'left:20px'   : 'right:20px',
            'z-index:99999',
            'display:flex',
            isBottom ? 'flex-direction:column-reverse' : 'flex-direction:column',
            'gap:10px',
            'pointer-events:none',
            'width:360px'
        ].join(';');

        document.body.appendChild(toastContainer);
        return toastContainer;
    }

    function makeTypeChip(type) {
        var c  = col(type);
        var el = document.createElement('div');
        el.style.cssText = [
            'width:26px',
            'height:26px',
            'border-radius:50%',
            'background:' + c.accent,
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'flex-shrink:0',
            'font-size:11px',
            'font-weight:700',
            'color:#fff',
            'font-family:monospace',
            'letter-spacing:-1px'
        ].join(';');
        el.textContent = c.letter;
        return el;
    }

    function showToast(title, body, type, timeoutMs) {
        if (!COLORS[type]) { type = 'info'; }
        if (typeof timeoutMs !== 'number') { timeoutMs = DEFAULT_TIMEOUT; }

        while (activeToasts.length >= MAX_TOASTS) {
            var oldest = activeToasts.shift();
            if (oldest && oldest.parentNode) { oldest.parentNode.removeChild(oldest); }
        }

        var c  = col(type);
        var el = document.createElement('div');
        el.style.cssText = [
            'background:var(--lighterGradientPoint)',
            'border:1px solid var(--borderColor)',
            'border-left:4px solid ' + c.accent,
            'border-radius:8px',
            'padding:12px 14px',
            'display:flex',
            'align-items:flex-start',
            'gap:10px',
            'pointer-events:all',
            'cursor:pointer',
            'opacity:0',
            'transform:translateX(40px)',
            'transition:opacity 0.22s ease, transform 0.22s ease',
            'box-shadow:0 4px 18px rgba(0,0,0,0.4)',
            'width:100%',
            'box-sizing:border-box',
            'color:var(--textColor)'
        ].join(';');

        el.appendChild(makeTypeChip(type));

        var textWrap = document.createElement('div');
        textWrap.style.cssText = 'flex:1;min-width:0;';

        if (title) {
            var titleEl = document.createElement('div');
            titleEl.style.cssText = 'font-size:13px;font-weight:600;margin-bottom:3px;color:var(--textColor);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
            titleEl.textContent   = title;
            textWrap.appendChild(titleEl);
        }

        if (body) {
            var bodyEl = document.createElement('div');
            bodyEl.style.cssText = 'font-size:12px;line-height:1.4;color:var(--dimTextColor);word-wrap:break-word;';
            bodyEl.textContent   = body;
            textWrap.appendChild(bodyEl);
        }

        el.appendChild(textWrap);

        var closeBtn = document.createElement('div');
        closeBtn.textContent   = 'x';
        closeBtn.style.cssText = 'flex-shrink:0;color:var(--dimTextColor);font-size:15px;line-height:1;cursor:pointer;font-family:monospace;margin-left:4px;';
        closeBtn.addEventListener('click', function(e) { e.stopPropagation(); dismissToast(el); });
        el.appendChild(closeBtn);

        el.addEventListener('click', function() { dismissToast(el); });

        activeToasts.push(el);
        getToastContainer().appendChild(el);

        requestAnimationFrame(function() {
            requestAnimationFrame(function() {
                el.style.opacity   = '1';
                el.style.transform = 'translateX(0)';
            });
        });

        if (timeoutMs > 0) {
            setTimeout(function() { dismissToast(el); }, timeoutMs);
        }

        return el;
    }

    function dismissToast(el) {
        if (!el || !el.parentNode) { return; }
        el.style.opacity   = '0';
        el.style.transform = 'translateX(40px)';
        setTimeout(function() {
            if (el.parentNode) { el.parentNode.removeChild(el); }
            var idx = activeToasts.indexOf(el);
            if (idx !== -1) { activeToasts.splice(idx, 1); }
        }, 260);
    }

    var bellBadge = null;

    function createBellButton() {
        var btn = document.createElement('button');
        btn.id  = 'jf-notify-bell';
        btn.setAttribute('type',  'button');
        btn.setAttribute('is',    'paper-icon-button-light');
        btn.setAttribute('title', 'Notifications');
        btn.className     = 'headerButton headerButtonRight paper-icon-button-light';
        btn.style.cssText = 'position:relative;';

        var icon = document.createElement('span');
        icon.className = 'material-icons';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = 'notifications';
        btn.appendChild(icon);

        var badge = document.createElement('span');
        badge.id = 'jf-notify-badge';
        badge.style.cssText = [
            'position:absolute',
            'top:4px',
            'right:4px',
            'background:#f44336',
            'color:#fff',
            'border-radius:10px',
            'min-width:16px',
            'height:16px',
            'font-size:10px',
            'font-weight:700',
            'line-height:16px',
            'text-align:center',
            'padding:0 3px',
            'box-sizing:border-box',
            'display:none',
            'pointer-events:none',
            'font-family:sans-serif'
        ].join(';');
        btn.appendChild(badge);

        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            togglePanel();
        });

        bellBadge = badge;
        return btn;
    }

    function updateBadge() {
        if (!bellBadge) {
            bellBadge = document.getElementById('jf-notify-badge');
        }
        if (!bellBadge) { return; }
        if (unreadCount <= 0) {
            bellBadge.style.display = 'none';
        } else {
            bellBadge.style.display = 'block';
            bellBadge.textContent   = unreadCount > 99 ? '99+' : String(unreadCount);
        }
    }

    function injectBell() {
        var headerRight = document.querySelector('.headerRight');
        if (!headerRight) { return; }
        if (document.getElementById('jf-notify-bell')) { return; }
        bellBadge = null;
        var firstChild = headerRight.firstChild || null;
        headerRight.insertBefore(createBellButton(), firstChild);
        updateBadge();
    }

    function watchHeader() {
        injectBell();
        var observer = new MutationObserver(function() {
            if (!document.getElementById('jf-notify-bell')) {
                injectBell();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    var panel     = null;
    var panelOpen = false;

    function ensurePanel() {
        if (panel && document.body.contains(panel)) { return panel; }

        panel = document.createElement('div');
        panel.id = 'jf-notify-panel';
        panel.style.cssText = [
            'position:fixed',
            'top:56px',
            'right:8px',
            'width:360px',
            'max-height:520px',
            'background:var(--lighterGradientPoint)',
            'border:1px solid var(--borderColor)',
            'border-radius:10px',
            'box-shadow:0 8px 32px rgba(0,0,0,0.5)',
            'z-index:99998',
            'display:flex',
            'flex-direction:column',
            'overflow:hidden',
            'opacity:0',
            'transform:translateY(-8px) scale(0.97)',
            'transition:opacity 0.18s ease, transform 0.18s ease',
            'pointer-events:none'
        ].join(';');

        var header = document.createElement('div');
        header.style.cssText = [
            'display:flex',
            'align-items:center',
            'justify-content:space-between',
            'padding:14px 16px 10px',
            'border-bottom:1px solid var(--borderColor)',
            'flex-shrink:0'
        ].join(';');

        var titleEl = document.createElement('span');
        titleEl.textContent   = 'Notifications';
        titleEl.style.cssText = 'font-size:15px;font-weight:600;color:var(--textColor);font-family:inherit;';

        var actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:14px;align-items:center;';

        var markReadBtn = document.createElement('button');
        markReadBtn.textContent   = 'Mark all read';
        markReadBtn.style.cssText = 'background:none;border:none;color:var(--activeColor);font-size:12px;cursor:pointer;padding:0;font-family:inherit;';
        markReadBtn.addEventListener('click', function() {
            markAllRead();
            renderPanelItems();
        });

        var clearBtn = document.createElement('button');
        clearBtn.textContent   = 'Clear';
        clearBtn.style.cssText = 'background:none;border:none;color:var(--dimTextColor);font-size:12px;cursor:pointer;padding:0;font-family:inherit;';
        clearBtn.addEventListener('click', function() { clearHistory(); });

        actions.appendChild(markReadBtn);
        actions.appendChild(clearBtn);
        header.appendChild(titleEl);
        header.appendChild(actions);

        var list = document.createElement('div');
        list.id            = 'jf-notify-panel-list';
        list.style.cssText = 'overflow-y:auto;flex:1;padding:4px 0;';

        panel.appendChild(header);
        panel.appendChild(list);
        document.body.appendChild(panel);
        return panel;
    }

    function renderPanelItems() {
        var p    = ensurePanel();
        var list = p.querySelector('#jf-notify-panel-list');
        if (!list) { return; }

        while (list.firstChild) { list.removeChild(list.firstChild); }

        if (notifHistory.length === 0) {
            var empty = document.createElement('div');
            empty.style.cssText = 'text-align:center;padding:40px 20px;color:var(--dimTextColor);font-size:13px;font-family:inherit;';
            empty.textContent   = 'No notifications yet.';
            list.appendChild(empty);
            return;
        }

        for (var i = 0; i < notifHistory.length; i++) {
            list.appendChild(makePanelItem(notifHistory[i]));
        }
    }

    function makePanelItem(entry) {
        var row = document.createElement('div');
        var baseRowBg = entry.read ? 'transparent' : 'rgba(var(--activeColorRgb, 0,164,220),0.06)';
        row.style.cssText = [
            'display:flex',
            'align-items:flex-start',
            'gap:10px',
            'padding:10px 16px',
            'border-bottom:1px solid var(--borderColor)',
            'background:' + baseRowBg
        ].join(';');

        row.addEventListener('mouseenter', function() { row.style.background = 'rgba(127,127,127,0.08)'; });
        row.addEventListener('mouseleave', function() { row.style.background = baseRowBg; });

        row.appendChild(makeTypeChip(entry.type));

        var mid = document.createElement('div');
        mid.style.cssText = 'flex:1;min-width:0;';

        if (entry.title) {
            var t = document.createElement('div');
            t.style.cssText = [
                'font-size:13px',
                'font-weight:' + (entry.read ? '400' : '600'),
                'color:' + (entry.read ? 'var(--dimTextColor)' : 'var(--textColor)'),
                'white-space:nowrap',
                'overflow:hidden',
                'text-overflow:ellipsis',
                'margin-bottom:2px',
                'font-family:inherit'
            ].join(';');
            t.textContent = entry.title;
            mid.appendChild(t);
        }

        if (entry.body) {
            var b = document.createElement('div');
            b.style.cssText = 'font-size:12px;color:var(--dimTextColor);line-height:1.4;word-wrap:break-word;font-family:inherit;';
            b.textContent   = entry.body;
            mid.appendChild(b);
        }

        var ts = document.createElement('div');
        ts.style.cssText = 'font-size:11px;color:var(--dimTextColor);opacity:0.6;margin-top:4px;font-family:inherit;';
        ts.textContent   = formatTime(entry.time);
        var tsInterval   = setInterval(function() {
            if (!document.body.contains(ts)) { clearInterval(tsInterval); return; }
            ts.textContent = formatTime(entry.time);
        }, 30000);
        mid.appendChild(ts);

        row.appendChild(mid);

        if (!entry.read) {
            var dot = document.createElement('div');
            dot.style.cssText = 'width:7px;height:7px;border-radius:50%;background:var(--activeColor);flex-shrink:0;margin-top:6px;';
            row.appendChild(dot);
        }

        return row;
    }

    function openPanel() {
        var p = ensurePanel();
        markAllRead();
        renderPanelItems();
        p.style.pointerEvents = 'all';
        requestAnimationFrame(function() {
            requestAnimationFrame(function() {
                p.style.opacity   = '1';
                p.style.transform = 'translateY(0) scale(1)';
            });
        });
        panelOpen = true;
        setTimeout(function() {
            document.addEventListener('click', onOutsideClick);
        }, 0);
    }

    function closePanel() {
        if (!panel) { return; }
        panel.style.opacity       = '0';
        panel.style.transform     = 'translateY(-8px) scale(0.97)';
        panel.style.pointerEvents = 'none';
        panelOpen = false;
        document.removeEventListener('click', onOutsideClick);
    }

    function togglePanel() {
        if (panelOpen) { closePanel(); } else { openPanel(); }
    }

    function onOutsideClick(e) {
        var p   = document.getElementById('jf-notify-panel');
        var btn = document.getElementById('jf-notify-bell');
        if (p && !p.contains(e.target) && btn && !btn.contains(e.target)) {
            closePanel();
        }
    }

    // -------------------------------------------------------------------------
    // WebSocket listener -- correct Jellyfin web client API
    //
    // The Jellyfin web client uses its own Events module (not DOM addEventListener).
    // ApiClient does NOT have addEventListener; it has an event emitter backed by
    // the jellyfin-apiclient Events system.
    //
    // Pattern: Events.on(target, eventName, handler)
    // Handler signature for 'message': function(e, msg)
    //   e   -- the internal event object (usually ignored)
    //   msg -- { MessageType: string, Data: any }
    // -------------------------------------------------------------------------
    function onWsMessage(e, msg) {
        if (!msg || msg.MessageType !== 'JellyFrameNotification') { return; }
        var d = msg.Data;
        if (!d) { return; }
        if (d.modId && d.modId !== 'notify-dispatcher') { return; }

        var data    = d.data || {};
        var title   = d.title || '';
        var body    = d.body  || '';
        var type    = d.type  || 'info';
        var timeout = typeof data.timeoutMs === 'number' ? data.timeoutMs : DEFAULT_TIMEOUT;

        addToHistory(title, body, type);
        showToast(title, body, type, timeout);
    }

    function initListener() {
        Events.on(ApiClient, 'message', onWsMessage);
    }

    var BASE_URL = '/JellyFrame/mods/notify-dispatcher/api';

    window.NotifyDispatcher = {
        showLocal: function(title, body, type, timeoutMs) {
            addToHistory(title, body, type || 'info');
            showToast(title, body, type || 'info', timeoutMs);
        },

        send: function(title, body, type, target) {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', BASE_URL + '/send', true);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.setRequestHeader('X-Emby-Authorization',
                'MediaBrowser Client="JellyFrame", Device="Browser", DeviceId="jf-mod", Version="1.0", Token="' + getAuthToken() + '"');
            xhr.onload = function() {
                if (xhr.status !== 200) { console.warn('[NotifyDispatcher] send failed:', xhr.responseText); }
            };
            xhr.send(JSON.stringify({ title: title, body: body, type: type || 'info', target: target || 'all' }));
        },

        sendToMe: function(title, body, type) {
            var userId = getMyUserId();
            if (!userId) { window.NotifyDispatcher.showLocal(title, body, type); return; }
            window.NotifyDispatcher.send(title, body, type, 'user:' + userId);
        },

        getSessions: function(cb) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', BASE_URL + '/sessions', true);
            xhr.setRequestHeader('X-Emby-Authorization',
                'MediaBrowser Client="JellyFrame", Device="Browser", DeviceId="jf-mod", Version="1.0", Token="' + getAuthToken() + '"');
            xhr.onload = function() {
                if (cb) {
                    try { cb(JSON.parse(xhr.responseText)); }
                    catch (err) { cb(null); }
                }
            };
            xhr.send();
        },

        getHistory:   function() { return notifHistory.slice(); },
        clearHistory: clearHistory,
        openPanel:    openPanel,
        closePanel:   closePanel
    };

    waitForReady(function() {
        initListener();
        watchHeader();
    });

})();
