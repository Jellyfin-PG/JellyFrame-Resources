(function () {
    // strict ES5 environment constraints as per JellyFrame rules
    var MOD_ID = "jellyfin-social";
    var PAGE_ID = "communityPage";
    var cachedPageNode = null;
    var lastKnownUserId = null;

    var isLoading = false;
    var hasMore = true;
    var lastTimestamp = null;
    var POSTS_PER_PAGE = 15;
    var expandedPosts = {};

    var cssString = [
        "/* Native page integration */",
        "#" + PAGE_ID + " { background-color: var(--theme-background, rgba(0,0,0,0)); color: var(--theme-text-color, #fff); }",
        "/* Aggressively hide Jellyfin's fallback and background pages when active */",
        "body[data-social-active='true'] #fallbackPage, ",
        "body[data-social-active='true'] .page:not(#" + PAGE_ID + "), ",
        "body[data-social-active='true'] .mainAnimatedPage:not(#" + PAGE_ID + ") { ",
        "    display: none !important; ",
        "    opacity: 0 !important; ",
        "    pointer-events: none !important; ",
        "}",
        ".social-container { max-width: 700px; margin: 0 auto; padding-top: 20px; padding-bottom: 60px; }",
        ".social-composer { background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 16px; margin-bottom: 30px; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1); position: relative; }",
        ".social-textarea { width: 100%; min-height: 80px; background: transparent !important; border: none !important; color: var(--theme-text-color, #fff) !important; font-family: inherit; font-size: 1.15em; resize: none; outline: none; margin-bottom: 8px; }",
        ".social-composer-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 12px; }",
        ".social-composer-tools { display: flex; gap: 8px; }",
        ".social-tool-btn { background: transparent; border: none; color: var(--theme-primary-color, #00a4dc); cursor: pointer; padding: 6px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }",
        ".social-tool-btn:hover { background: rgba(0, 164, 220, 0.1); }",
        ".social-emoji-picker { position: absolute; bottom: 60px; left: 16px; background: #252525; border: 1px solid #444; border-radius: 8px; padding: 10px; display: none; grid-template-columns: repeat(5, 1fr); gap: 8px; z-index: 1000; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }",
        ".social-emoji-item { cursor: pointer; font-size: 1.4em; padding: 4px; text-align: center; border-radius: 4px; transition: background 0.1s; }",
        ".social-emoji-item:hover { background: #333; }",
        ".social-post-card { background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; margin-bottom: 20px; display: flex; flex-direction: column; transition: background 0.2s ease; }",
        ".social-post-header { display: flex; align-items: center; margin-bottom: 12px; }",
        ".social-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--theme-primary-color, #00a4dc); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.3em; margin-right: 14px; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2); flex-shrink: 0; }",
        ".social-author-info { display: flex; flex-direction: column; }",
        ".social-author-name { font-weight: 600; font-size: 1.05em; color: var(--theme-text-color, #fff); }",
        ".social-post-time { font-size: 0.85em; color: rgba(255, 255, 255, 0.4); margin-top: 2px; }",
        ".social-post-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding-top: 12px; border-top: 1px solid rgba(255, 255, 255, 0.05); }",
        ".social-post-actions-left { display: flex; flex-direction: row; gap: 12px; }",
        ".social-post-actions-right { display: flex; flex-direction: row; gap: 8px; }",
        ".social-post-action-btn { background: transparent; border: none; color: rgba(255, 255, 255, 0.5); cursor: pointer; padding: 4px 8px; border-radius: 6px; font-size: 0.85em; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 5px; }",
        ".social-post-action-btn:hover { color: var(--theme-text-color, #fff); background: rgba(255, 255, 255, 0.08); }",
        ".social-post-content { font-size: 1.1em; line-height: 1.5; color: rgba(255, 255, 255, 0.9); white-space: pre-wrap; word-break: break-word; padding-left: 58px; }",
        ".social-reactions-display { display: flex; flex-direction: row; flex-wrap: wrap; gap: 6px; margin-top: 10px; margin-left: 58px; }",
        ".social-reaction-pill { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 2px 10px; font-size: 0.85em; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; transition: background 0.2s; }",
        ".social-reaction-pill:hover { background: rgba(255, 255, 255, 0.12); }",
        ".social-reaction-pill.active { background: rgba(0, 164, 220, 0.15); border-color: var(--theme-primary-color, #00a4dc); }",
        ".social-comments-section { margin-top: 15px; margin-left: 58px; border-left: 2px solid rgba(255, 255, 255, 0.05); padding-left: 15px; }",
        ".social-comments-toggle { color: var(--theme-primary-color, #00a4dc); font-size: 0.85em; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; padding: 8px 0; user-select: none; }",
        ".social-comments-toggle:hover { text-decoration: underline; }",
        ".social-comments-list { display: none; margin-top: 10px; margin-bottom: 10px; }",
        ".social-comment-card { margin-bottom: 12px; font-size: 0.95em; }",
        ".social-comment-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }",
        ".social-comment-author { font-weight: 600; color: var(--theme-primary-color, #00a4dc); }",
        ".social-comment-time { font-size: 0.8em; color: rgba(255, 255, 255, 0.3); }",
        ".social-comment-actions { display: flex; gap: 8px; margin-top: 4px; }",
        ".social-comment-action-link { font-size: 0.8em; color: rgba(255, 255, 255, 0.3); cursor: pointer; text-decoration: none; }",
        ".social-comment-action-link:hover { color: var(--theme-text-color, #fff); }",
        ".social-comment-input-wrap { margin-top: 10px; display: flex; flex-direction: row; gap: 8px; align-items: center; }",
        ".social-comment-input { flex: 1; background: rgba(0, 0, 0, 0.2) !important; border: 1px solid rgba(255, 255, 255, 0.1) !important; color: #fff !important; padding: 8px 12px; border-radius: 20px; font-size: 0.9em; outline: none; }",
        ".social-comment-submit-btn { background: var(--theme-primary-color, #00a4dc); color: #fff; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.2s; flex-shrink: 0; }",
        ".social-item-embed { margin-top: 15px; margin-left: 58px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; overflow: hidden; background: rgba(0, 0, 0, 0.35); transition: all 0.2s ease; min-height: 96px; display: block; position: relative; }",
        ".social-item-embed:hover { border-color: var(--theme-primary-color, #00a4dc); background: rgba(0, 0, 0, 0.55); }",
        ".social-item-embed-link { display: flex; flex-direction: row; text-decoration: none; color: inherit; align-items: center; }",
        ".social-item-embed-img { width: 64px; height: 96px; object-fit: cover; background: #000; flex-shrink: 0; }",
        ".social-item-embed-placeholder { width: 64px; height: 96px; background: rgba(255, 255, 255, 0.05); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }",
        ".social-item-embed-placeholder .material-icons { color: rgba(255, 255, 255, 0.25); font-size: 32px; }",
        ".social-item-embed-info { padding: 12px 16px; display: flex; flex-direction: column; justify-content: center; overflow: hidden; }",
        ".social-item-embed-title { font-weight: 600; font-size: 1.05em; margin-bottom: 3px; color: var(--theme-text-color, #fff); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
        ".social-item-embed-year { font-size: 0.88em; color: rgba(255, 255, 255, 0.5); }",
        ".social-item-embed-type { font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.08em; color: var(--theme-primary-color, #00a4dc); margin-top: 5px; font-weight: 700; }",
        ".social-edit-actions .cancel { background-color: #cc3333 !important; color: #fff !important; }",
        ".social-infinite-loader { text-align: center; padding: 30px; font-size: 0.9em; color: rgba(255,255,255,0.4); width: 100%; }",
        "@media(max-width: 600px) { .social-post-content, .social-item-embed, .social-edit-wrapper, .social-comments-section, .social-reactions-display { padding-left: 0; margin-left: 0; margin-top: 12px; } .social-container { padding-top: 10px; } }"
    ].join('\n');

    function injectStyles() {
        if (document.getElementById('jf-social-styles')) return;
        var style = document.createElement('style');
        style.id = 'jf-social-styles';
        style.type = 'text/css';
        style.appendChild(document.createTextNode(cssString));
        document.head.appendChild(style);
    }
    injectStyles();

    function findApiClient() {
        return window.ApiClient || (window.App && window.App.apiClient) || null;
    }

    function getAppUserId() {
        var match = window.location.hash.match(/[?&]userId=([a-fA-F0-9]{32}|[a-zA-Z0-9-]+)/i);
        if (match) return match[1];

        var client = findApiClient();
        if (client && typeof client.getCurrentUserId === 'function') return client.getCurrentUserId();

        var auth = localStorage.getItem('ApiClient-Authorization') || '';
        var authMatch = auth.match(/UserId="([^"]+)"/i);
        return authMatch ? authMatch[1] : null;
    }

    function getAppUserName() {
        var userBtn = document.querySelector('.headerUserButton');
        if (userBtn && userBtn.getAttribute('title')) {
            var t = userBtn.getAttribute('title');
            if (t !== 'User' && t !== 'Account') return t;
        }
        var client = findApiClient();
        if (client && client._serverInfo && client._serverInfo.User) return client._serverInfo.User.Name;
        return 'User';
    }

    function getInitials(name) { return name ? name.charAt(0).toUpperCase() : '?'; }
    function timeAgo(dt) {
        var d = new Date(dt), s = Math.floor((new Date() - d) / 1000);
        var i = s / 31536000; if (i > 1) return Math.floor(i) + "y";
        i = s / 2592000; if (i > 1) return Math.floor(i) + "mo";
        i = s / 86400; if (i > 1) return Math.floor(i) + "d";
        i = s / 3600; if (i > 1) return Math.floor(i) + "h";
        i = s / 60; if (i > 1) return Math.floor(i) + "m";
        return "now";
    }

    function handleRoute() {
        var isCommunity = window.location.hash.indexOf('#/community') !== -1;
        if (isCommunity) {
            var uid = getAppUserId();
            if (uid && window.location.hash.indexOf('userId=' + uid) === -1) {
                var currentHash = window.location.hash.split('?')[0];
                history.replaceState(null, 'Community', currentHash + '?userId=' + uid);
            }

            document.body.setAttribute('data-social-active', 'true');
            if (!cachedPageNode) cachedPageNode = createSocialFeedPageNode();

            var skinBody = document.querySelector('.skinBody') || document.body;
            if (!document.body.contains(cachedPageNode)) skinBody.appendChild(cachedPageNode);
            cachedPageNode.style.display = 'block';
            cachedPageNode.classList.remove('hide');

            var pt = document.querySelector('.skinHeader .pageTitle');
            if (pt) { pt.innerText = 'Community'; document.title = 'Community'; }
        } else {
            document.body.removeAttribute('data-social-active');
            if (cachedPageNode && document.body.contains(cachedPageNode)) {
                cachedPageNode.style.display = 'none';
                cachedPageNode.classList.add('hide');
            }
        }
    }

    window.addEventListener('popstate', handleRoute);
    window.addEventListener('hashchange', handleRoute);
    handleRoute();

    function injectMenu() {
        var menu = document.querySelector('.customMenuOptions');
        if (menu && !document.getElementById('nav-social-btn')) {
            var link = document.createElement('a');
            link.id = 'nav-social-btn';
            link.className = 'lnkMediaFolder navMenuOption emby-button';
            link.href = '#/community';
            link.setAttribute('is', 'emby-linkbutton');
            link.innerHTML = '<span class="material-icons navMenuOptionIcon">forum</span><span class="sectionName navMenuOptionText">Community</span>';
            link.onclick = function (e) {
                e.preventDefault();
                var uid = getAppUserId() || '';
                var target = '#/community?userId=' + uid;
                if (window.location.hash !== target) history.pushState({ j: 1 }, 'Social', target);
                handleRoute();
                var dr = document.querySelector('.mainDrawer');
                if (dr && dr.classList.contains('drawer-open')) {
                    var db = document.querySelector('.headerButton.paper-icon-button-light');
                    if (db) db.click();
                }
            };
            menu.appendChild(link);
        }
    }

    setInterval(function () {
        injectMenu();
        var currentUid = getAppUserId();

        if (currentUid !== lastKnownUserId) {
            if (cachedPageNode && cachedPageNode.parentNode) {
                cachedPageNode.parentNode.removeChild(cachedPageNode);
            }
            cachedPageNode = null;
            lastTimestamp = null;
            hasMore = true;
            isLoading = false;
            expandedPosts = {};
            lastKnownUserId = currentUid;

            if (window.location.hash.indexOf('#/community') !== -1) {
                handleRoute();
            }
        }

        var isCommunity = window.location.hash.indexOf('#/community') !== -1;
        var isActive = document.body.getAttribute('data-social-active') === 'true';

        if (isCommunity !== isActive) handleRoute();

        if (isCommunity) {
            var skinBody = document.querySelector('.skinBody') || document.body;
            if (cachedPageNode && !document.body.contains(cachedPageNode)) {
                skinBody.appendChild(cachedPageNode);
            }
            var pt = document.querySelector('.skinHeader .pageTitle');
            if (pt && pt.innerText !== 'Community') { pt.innerText = 'Community'; document.title = 'Community'; }
        }
    }, 100);

    window.addEventListener('scroll', function () {
        if (!hasMore || isLoading) return;
        var isCommunity = window.location.hash.indexOf('#/community') !== -1;
        if (!isCommunity) return;

        var scrollHeight = document.documentElement.scrollHeight;
        var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        var clientHeight = window.innerHeight;

        if (scrollTop + clientHeight >= scrollHeight - 800) {
            var feed = document.querySelector('.social-feed-container');
            if (feed) loadPosts(feed, false);
        }
    }, { passive: true });

    function createSocialFeedPageNode() {
        var page = document.createElement('div');
        page.id = PAGE_ID;
        page.setAttribute('data-role', 'page');
        page.className = 'page mainAnimatedPage libraryPage noSecondaryNavPage jellyfin-social-theme';
        var inner = document.createElement('div');
        inner.className = 'padded-left padded-right padded-bottom-page';
        var container = document.createElement('div');
        container.className = 'social-container';

        var comp = document.createElement('div');
        comp.className = 'social-composer';
        var area = document.createElement('textarea');
        area.placeholder = "Link a movie or share what's on your mind...";
        area.className = 'social-textarea emby-input';

        var emojiPicker = document.createElement('div');
        emojiPicker.className = 'social-emoji-picker';
        var emojis = ['🎬', '🍿', '📺', '⭐', '🎮', '🔥', '🎉', '👍', '😮', '❤️'];
        for (var i = 0; i < emojis.length; i++) {
            (function (eChar) {
                var eItem = document.createElement('div');
                eItem.className = 'social-emoji-item';
                eItem.innerText = eChar;
                eItem.onclick = function () { area.value += eChar; emojiPicker.style.display = 'none'; area.focus(); };
                emojiPicker.appendChild(eItem);
            })(emojis[i]);
        }
        comp.appendChild(emojiPicker);

        var foot = document.createElement('div');
        foot.className = 'social-composer-footer';
        var tools = document.createElement('div');
        tools.className = 'social-composer-tools';
        var emojiBtn = document.createElement('button');
        emojiBtn.className = 'social-tool-btn';
        emojiBtn.innerHTML = '<span class="material-icons">sentiment_satisfied</span>';
        emojiBtn.onclick = function () { emojiPicker.style.display = (emojiPicker.style.display === 'grid' ? 'none' : 'grid'); };

        var mediaBtn = document.createElement('button');
        mediaBtn.className = 'social-tool-btn';
        mediaBtn.innerHTML = '<span class="material-icons">movie_filter</span>';
        mediaBtn.onclick = function () {
            var q = prompt("Search media to link:");
            var client = findApiClient();
            if (q && client) {
                client.getItems(getAppUserId(), { searchTerm: q, limit: 5, includeItemTypes: "Movie,Series,Episode,Book", recursive: true }).then(function (res) {
                    var found = (res.Items || []).filter(function (x) { return x.Type !== 'CollectionFolder'; })[0];
                    if (found) area.value += " [id:" + found.Id + "] ";
                });
            }
        };

        tools.appendChild(emojiBtn); tools.appendChild(mediaBtn);
        var btn = document.createElement('button');
        btn.className = 'emby-button raised button-submit';
        btn.innerHTML = '<span class="material-icons" style="margin-right:6px;font-size:1.2em;vertical-align:middle">send</span>Post';

        var feed = document.createElement('div');
        feed.className = 'social-feed-container';

        btn.onclick = function () {
            var txt = area.value.trim(); if (!txt) return;
            submitPost(txt, function () { area.value = ''; loadPosts(feed, true); });
        };

        foot.appendChild(tools); foot.appendChild(btn);
        comp.appendChild(area); comp.appendChild(foot);
        container.appendChild(comp); container.appendChild(feed);
        inner.appendChild(container); page.appendChild(inner);

        loadPosts(feed, true);
        return page;
    }

    function parseContentForIDs(content) {
        var words = content.split(/\s+/);
        var primaryId = null;
        var processedWords = [];
        var urlIdRegex = /[?&](?:id|itemId|parentId)=([a-fA-F0-9]{32})/i;
        for (var i = 0; i < words.length; i++) {
            var m = words[i].match(urlIdRegex);
            if (m) {
                if (!primaryId) primaryId = m[1];
                processedWords.push("[id:" + m[1] + "]");
            } else {
                processedWords.push(words[i]);
            }
        }
        return { text: processedWords.join(' '), id: primaryId };
    }

    function submitPost(content, cb) {
        var uid = getAppUserId(); if (!uid) return;
        var p = parseContentForIDs(content);
        fetch('/JellyFrame/mods/' + MOD_ID + '/api/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: uid, userName: getAppUserName(), content: p.text, itemId: p.id })
        }).then(function (r) { return r.json(); }).then(function () { if (cb) cb(); });
    }

    function editPost(pid, content, cb) {
        var p = parseContentForIDs(content);
        fetch('/JellyFrame/mods/' + MOD_ID + '/api/posts/' + pid, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: p.text, itemId: p.id })
        }).then(function (r) { return r.json(); }).then(function () { if (cb) cb(); });
    }

    function deletePost(pid, cb) {
        fetch('/JellyFrame/mods/' + MOD_ID + '/api/posts/' + pid, { method: 'DELETE' }).then(function (r) { return r.json(); }).then(function () { if (cb) cb(); });
    }

    function toggleReaction(postId, emoji, cb) {
        var uid = getAppUserId(); if (!uid) return;
        fetch('/JellyFrame/mods/' + MOD_ID + '/api/posts/' + postId + '/reactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: uid, userName: getAppUserName(), emoji: emoji })
        }).then(function (r) { return r.json(); }).then(cb);
    }

    function addComment(postId, content, cb) {
        var uid = getAppUserId(); if (!uid) return;
        fetch('/JellyFrame/mods/' + MOD_ID + '/api/posts/' + postId + '/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: uid, userName: getAppUserName(), content: content })
        }).then(function (r) { return r.json(); }).then(cb);
    }

    function deleteComment(commentId, cb) {
        fetch('/JellyFrame/mods/' + MOD_ID + '/api/comments/' + commentId, { method: 'DELETE' }).then(function (r) { return r.json(); }).then(cb);
    }

    function editComment(commentId, content, cb) {
        fetch('/JellyFrame/mods/' + MOD_ID + '/api/comments/' + commentId, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: content })
        }).then(function (r) { return r.json(); }).then(cb);
    }

    function loadPosts(container, reset) {
        if (isLoading) return;
        var uid = getAppUserId();
        if (!uid && window.location.hash.indexOf('#/community') !== -1) {
            setTimeout(function () { loadPosts(container, reset); }, 500);
            return;
        }

        if (reset) {
            container.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.4)">Loading Community...</div>';
            lastTimestamp = null;
            hasMore = true;
        } else {
            var loader = document.createElement('div');
            loader.className = 'social-infinite-loader';
            loader.innerText = 'Loading older posts...';
            container.appendChild(loader);
        }

        isLoading = true;
        var url = '/JellyFrame/mods/' + MOD_ID + '/api/posts?limit=' + POSTS_PER_PAGE;
        if (lastTimestamp) url += '&before=' + encodeURIComponent(lastTimestamp);

        fetch(url).then(function (r) { return r.json(); }).then(function (data) {
            var loaders = container.querySelectorAll('.social-infinite-loader');
            for (var l = 0; l < loaders.length; l++) loaders[l].parentNode.removeChild(loaders[l]);

            if (reset) container.innerHTML = '';
            var posts = data.posts || [];
            if (posts.length === 0) {
                if (reset) container.innerHTML = '<div style="text-align:center;padding:40px;color:rgba(255,255,255,0.3)">No posts yet.</div>';
                hasMore = false; isLoading = false; return;
            }
            if (posts.length < POSTS_PER_PAGE) hasMore = false;
            lastTimestamp = posts[posts.length - 1].timestamp;

            var cleanCurUid = uid ? String(uid).replace(/-/g, '').toLowerCase() : '';
            var curUname = getAppUserName();

            for (var i = 0; i < posts.length; i++) {
                var p = posts[i];
                var card = document.createElement('div');
                card.className = 'social-post-card card';

                var head = document.createElement('div'); head.className = 'social-post-header';
                var avName = (p.userName && p.userName !== 'Unknown') ? p.userName : 'U';
                var av = document.createElement('div'); av.className = 'social-avatar'; av.innerText = getInitials(avName);
                var info = document.createElement('div'); info.className = 'social-author-info';
                var name = document.createElement('div'); name.className = 'social-author-name'; name.innerText = p.userName || 'User';
                var time = document.createElement('div'); time.className = 'social-post-time'; time.innerText = timeAgo(p.timestamp);
                info.appendChild(name); info.appendChild(time); head.appendChild(av); head.appendChild(info);

                var exIds = []; if (p.itemId) exIds.push(p.itemId);

                var contentText = p.content || '';
                contentText = contentText.replace(/\[id:([a-fA-F0-9]{32})\]/ig, function (m, id) {
                    if (exIds.indexOf(id) === -1) exIds.push(id);
                    return '';
                }).trim();

                var safe = contentText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                safe = safe.replace(/(https?:\/\/[^\s&]+)/g, '<a href="$1" target="_blank" style="color:var(--theme-primary-color);text-decoration:none">$1</a>');

                card.appendChild(head);
                var contentNode = document.createElement('div');
                contentNode.className = 'social-post-content';
                contentNode.innerHTML = safe || (exIds.length > 0 ? '' : '...');
                card.appendChild(contentNode);

                if (exIds.length > 0) {
                    exIds.forEach(function (eid) {
                        var ew = document.createElement('div');
                        ew.className = 'social-item-embed';
                        ew.innerHTML = '<div style="padding:16px;font-size:0.85em;opacity:0.5">Fetching media metadata...</div>';
                        card.appendChild(ew);

                        (function (wrapper, itemId, userId) {
                            var attempts = 0;
                            var tryFetch = function () {
                                var client = findApiClient();
                                if (client) {
                                    client.getItem(userId, itemId).then(function (item) {
                                        if (!item) { wrapper.style.display = 'none'; return; }
                                        var imgUrl = (item.ImageTags && item.ImageTags.Primary) ? client.getImageUrl(item.Id, { type: 'Primary', maxWidth: 120, tag: item.ImageTags.Primary }) : null;
                                        var img = imgUrl ? '<img src="' + imgUrl + '" class="social-item-embed-img" />' : '<div class="social-item-embed-placeholder"><span class="material-icons">movie</span></div>';
                                        var el = document.createElement('a'); el.href = '#/details?id=' + item.Id + '&serverId=' + item.ServerId; el.className = 'social-item-embed-link';
                                        el.innerHTML = img + '<div class="social-item-embed-info"><div class="social-item-embed-title">' + item.Name + '</div><div class="social-item-embed-year">' + (item.ProductionYear || '') + '</div><div class="social-item-embed-type">' + (item.Type || 'Item') + '</div></div>';
                                        el.onclick = function () { handleRoute(); };
                                        wrapper.innerHTML = ''; wrapper.appendChild(el);
                                    }).catch(function () { wrapper.style.display = 'none'; });
                                } else if (attempts < 5) {
                                    attempts++;
                                    setTimeout(tryFetch, 500);
                                } else {
                                    wrapper.style.display = 'none';
                                }
                            };
                            tryFetch();
                        })(ew, eid, uid);
                    });
                }

                var reactDisplay = document.createElement('div'); reactDisplay.className = 'social-reactions-display';
                var reactionsMap = {}; (p.reactions || []).forEach(function (r) {
                    if (!reactionsMap[r.emoji]) reactionsMap[r.emoji] = { count: 0, me: false };
                    reactionsMap[r.emoji].count++; if (String(r.userId).replace(/-/g, '').toLowerCase() === cleanCurUid) reactionsMap[r.emoji].me = true;
                });
                Object.keys(reactionsMap).forEach(function (eChar) {
                    var rPill = document.createElement('div'); rPill.className = 'social-reaction-pill' + (reactionsMap[eChar].me ? ' active' : '');
                    rPill.innerHTML = '<span>' + eChar + '</span> <span style="opacity:0.7">' + reactionsMap[eChar].count + '</span>';
                    rPill.onclick = function () { toggleReaction(p.id, eChar, function () { loadPosts(container, true); }); };
                    reactDisplay.appendChild(rPill);
                });
                card.appendChild(reactDisplay);

                var commSection = document.createElement('div'); commSection.className = 'social-comments-section';
                var commCount = (p.comments || []).length;
                var toggle = null;
                if (commCount > 0) {
                    toggle = document.createElement('div'); toggle.className = 'social-comments-toggle';
                    var isExp = expandedPosts[p.id] || false;
                    toggle.innerHTML = '<span class="material-icons" style="font-size:16px">' + (isExp ? 'expand_less' : 'comment') + '</span>' + (isExp ? 'Hide comments' : 'Show ' + commCount + ' comments');
                    commSection.appendChild(toggle);
                }
                var commList = document.createElement('div'); commList.className = 'social-comments-list';
                if (expandedPosts[p.id]) commList.style.display = 'block';
                if (toggle) {
                    toggle.onclick = (function (pid, listNode, toggleNode) {
                        return function () {
                            var nowShown = listNode.style.display === 'block'; listNode.style.display = nowShown ? 'none' : 'block';
                            expandedPosts[pid] = !nowShown;
                            toggleNode.innerHTML = '<span class="material-icons" style="font-size:16px">' + (!nowShown ? 'expand_less' : 'comment') + '</span>' + (!nowShown ? 'Hide comments' : 'Show ' + commCount + ' comments');
                        };
                    })(p.id, commList, toggle);
                }

                (p.comments || []).forEach(function (c) {
                    var cCard = document.createElement('div'); cCard.className = 'social-comment-card';
                    cCard.innerHTML = '<div class="social-comment-header"><span class="social-comment-author">' + c.userName + '</span><span class="social-comment-time">' + timeAgo(c.timestamp) + '</span></div><div class="c-txt">' + c.content + '</div>';
                    if (String(c.userId).replace(/-/g, '').toLowerCase() === cleanCurUid) {
                        var cActs = document.createElement('div'); cActs.className = 'social-comment-actions';
                        var cEdit = document.createElement('a'); cEdit.className = 'social-comment-action-link'; cEdit.innerText = 'Edit';
                        var cDel = document.createElement('a'); cDel.className = 'social-comment-action-link'; cDel.innerText = 'Delete';
                        (function (cid, btn) {
                            var conf = false; btn.onclick = function () {
                                if (!conf) { conf = true; btn.innerText = 'Confirm?'; btn.style.color = '#ff4444'; setTimeout(function () { conf = false; btn.innerText = 'Delete'; btn.style.color = ''; }, 3000); }
                                else deleteComment(cid, function () { loadPosts(container, true); });
                            };
                        })(c.id, cDel);
                        cEdit.onclick = (function (cid, oC) { return function () { var val = prompt("Edit comment:", oC); if (val && val !== oC) editComment(cid, val, function () { loadPosts(container, true); }); }; })(c.id, c.content);
                        cActs.appendChild(cEdit); cActs.appendChild(cDel); cCard.appendChild(cActs);
                    }
                    commList.appendChild(cCard);
                });

                var ciw = document.createElement('div'); ciw.className = 'social-comment-input-wrap';
                var ci = document.createElement('input'); ci.className = 'social-comment-input'; ci.placeholder = 'Write a comment...';
                var cs = document.createElement('button'); cs.className = 'social-comment-submit-btn'; cs.innerHTML = '<span class="material-icons" style="font-size:18px">send</span>';
                var doAdd = (function (pid, inp) {
                    return function () { var v = inp.value.trim(); if (v) { expandedPosts[pid] = true; addComment(pid, v, function () { loadPosts(container, true); }); } };
                })(p.id, ci);
                cs.onclick = doAdd; ci.onkeydown = function (ev) { if (ev.keyCode === 13) doAdd(); };
                ciw.appendChild(ci); ciw.appendChild(cs); commSection.appendChild(commList); commSection.appendChild(ciw); card.appendChild(commSection);

                var foot = document.createElement('div'); foot.className = 'social-post-footer';
                var al = document.createElement('div'); al.className = 'social-post-actions-left';
                ['❤️', '🔥', '👍', '😮'].forEach(function (em) {
                    var eb = document.createElement('button'); eb.className = 'social-post-action-btn'; eb.innerText = em;
                    eb.onclick = function () { toggleReaction(p.id, em, function () { loadPosts(container, true); }); }; al.appendChild(eb);
                });
                var isAuth = (String(p.userId).replace(/-/g, '').toLowerCase() === cleanCurUid) || (p.userName && curUname && p.userName.toLowerCase() === curUname.toLowerCase());
                var ar = document.createElement('div'); ar.className = 'social-post-actions-right';
                if (isAuth) {
                    var ebt = document.createElement('button'); ebt.className = 'social-post-action-btn'; ebt.innerHTML = '<span class="material-icons" style="font-size:1.1em">edit</span>';
                    var dbt = document.createElement('button'); dbt.className = 'social-post-action-btn'; dbt.innerHTML = '<span class="material-icons" style="font-size:1.1em">delete</span>';
                    (function (pid, btn) {
                        var conf = false; btn.onclick = function () {
                            if (!conf) { conf = true; btn.style.color = '#FF4444'; btn.innerHTML = '<span class="material-icons">delete_forever</span>'; setTimeout(function () { conf = false; btn.style.color = ''; btn.innerHTML = '<span class="material-icons">delete</span>'; }, 3000); }
                            else deletePost(pid, function () { loadPosts(container, true); });
                        };
                    })(p.id, dbt);
                    ebt.onclick = (function (pid, ot) { return function () { var val = prompt("Edit status:", ot); if (val && val !== ot) editPost(pid, val, function () { loadPosts(container, true); }); }; })(p.id, p.content);
                    ar.appendChild(ebt); ar.appendChild(dbt);
                }
                foot.appendChild(al); foot.appendChild(ar); card.appendChild(foot); container.appendChild(card);
            }
            isLoading = false;
        }).catch(function () {
            container.innerHTML = '<div style="text-align:center;padding:20px;color:#FF4444">Failed to load feed.</div>';
            isLoading = false;
        });
    }
})();
