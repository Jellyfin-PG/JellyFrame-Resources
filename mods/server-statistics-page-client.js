(function () {
    const STATS_ROUTE = '#/serverstats';
    const VIRTUAL_PAGE_ID = 'jf-stats-page';
    const STYLE_ID = 'jf-stats-styles';
    const SIDEBAR_LINK_CLASS = 'jf-stats-sidebar-link';

    let activeTab = 0;
    let currentRouteState = null; 
    let isFetchingData = false;
    let observerFrameId = null;

    let desktopInjected = false;
    let mobileInjected = false;

    function safeCreateElement(tagName, options) {
        try {
            if (options) {
                return document.createElement.call(document, tagName, options);
            }
            return document.createElement.call(document, tagName);
        } catch (e) {
            const el = document.createElement(tagName);
            if (options && typeof options === 'string') {
                el.setAttribute('is', options);
            } else if (options && options.is) {
                el.setAttribute('is', options.is);
            }
            return el;
        }
    }

    function getApiClient() {
        return window.ApiClient || window.apiClient;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = safeCreateElement('style');
        style.id = STYLE_ID;
        style.innerHTML = `
            .jf-custom-stats-page {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                background-color: #121212 !important;
                color: #ffffff !important;
                font-family: 'Roboto', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
                z-index: 99999 !important;
                overflow-y: auto !important;
                display: none;
                box-sizing: border-box !important;
            }
            .mui-appbar {
                background-color: #1e1e1e !important;
                box-shadow: 0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12) !important;
                position: sticky !important;
                top: 0 !important;
                z-index: 110 !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.12) !important;
            }
            .mui-header-content {
                display: flex !important;
                align-items: center !important;
                padding: 16px 24px !important;
                gap: 16px !important;
            }
            .mui-header-title {
                font-size: 20px !important;
                font-weight: 500 !important;
                letter-spacing: 0.15px !important;
                flex-grow: 1 !important;
                margin: 0 !important;
            }
            .mui-tabs {
                display: flex !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.12) !important;
                background-color: #1e1e1e !important;
                padding: 0 16px !important;
            }
            .mui-tab-button {
                background: none !important;
                border: none !important;
                color: rgba(255, 255, 255, 0.7) !important;
                padding: 14px 24px !important;
                font-size: 14px !important;
                font-weight: 500 !important;
                letter-spacing: 0.4px !important;
                text-transform: uppercase !important;
                cursor: pointer !important;
                position: relative !important;
                transition: color 0.2s, background-color 0.2s !important;
                display: flex !important;
                align-items: center !important;
                gap: 8px !important;
            }
            .mui-tab-button:hover {
                color: #ffffff !important;
                background-color: rgba(255, 255, 255, 0.04) !important;
            }
            .mui-tab-button.active {
                color: #00a4dc !important;
            }
            .mui-tab-button.active::after {
                content: '' !important;
                position: absolute !important;
                bottom: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 3px !important;
                background-color: #00a4dc !important;
                border-radius: 3px 3px 0 0 !important;
            }
            .mui-content-area {
                padding: 32px 24px !important;
                max-width: 1200px !important;
                margin: 0 auto !important;
                box-sizing: border-box !important;
            }
            .mui-paper {
                background-color: #1e1e1e !important;
                border-radius: 12px !important;
                border: 1px solid rgba(255, 255, 255, 0.12) !important;
                box-shadow: 0px 1px 3px rgba(0,0,0,0.2) !important;
                padding: 24px !important;
                margin-bottom: 24px !important;
                transition: box-shadow 0.3s ease !important;
            }
            .mui-paper:hover {
                box-shadow: 0px 4px 12px rgba(0,0,0,0.4) !important;
            }
            .mui-card-header {
                display: flex !important;
                align-items: center !important;
                gap: 12px !important;
                margin-bottom: 20px !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.12) !important;
                padding-bottom: 12px !important;
            }
            .mui-card-title {
                font-size: 15px !important;
                font-weight: 500 !important;
                color: #ffffff !important;
                margin: 0 !important;
                text-transform: uppercase !important;
                letter-spacing: 1px !important;
            }
            .mui-grid {
                display: grid !important;
                grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)) !important;
                gap: 24px !important;
            }
            @media (max-width: 768px) {
                .mui-grid {
                    grid-template-columns: 1fr !important;
                }
            }
            .mui-list-item {
                display: flex !important;
                align-items: center !important;
                padding: 12px 16px !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
                gap: 16px !important;
            }
            .mui-list-item:last-child {
                border-bottom: none !important;
            }
            .mui-avatar {
                width: 40px !important;
                height: 40px !important;
                border-radius: 50% !important;
                background-color: rgba(0, 164, 220, 0.15) !important;
                border: 2px solid #00a4dc !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-weight: 600 !important;
                color: #00a4dc !important;
                flex-shrink: 0 !important;
            }
            .mui-list-item-content {
                flex-grow: 1 !important;
                min-width: 0 !important;
            }
            .mui-list-item-text {
                font-size: 14px !important;
                font-weight: 500 !important;
                color: #e2e2e2 !important;
                margin: 0 0 2px 0 !important;
                text-overflow: ellipsis !important;
                overflow: hidden !important;
                white-space: nowrap !important;
            }
            .mui-list-item-subtext {
                font-size: 12px !important;
                color: rgba(255, 255, 255, 0.5) !important;
                margin: 0 !important;
            }
            .mui-list-item-action {
                font-size: 18px !important;
                font-weight: 700 !important;
                color: #00a4dc !important;
            }
            .mui-progress-wrapper {
                margin-top: 8px !important;
            }
            .mui-progress-bar-container {
                width: 100% !important;
                height: 8px !important;
                background-color: rgba(255, 255, 255, 0.08) !important;
                border-radius: 4px !important;
                overflow: hidden !important;
                margin-top: 4px !important;
            }
            .mui-progress-bar-fill {
                height: 100% !important;
                background-color: #00a4dc !important;
                border-radius: 4px !important;
                transition: width 0.8s ease-out !important;
            }
            .animate-spin {
                animation: jf-spin 1s linear infinite !important;
            }
            @keyframes jf-spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    function toggleVirtualPage(show) {
        let virtualPage = document.getElementById(VIRTUAL_PAGE_ID);
        if (!virtualPage) {
            virtualPage = createVirtualPage();
        }

        if (show) {
            injectStyles();
            virtualPage.style.setProperty('display', 'block', 'important');
            
            const drawer = document.querySelector('.mainDrawer-open');
            if (drawer) {
                drawer.classList.remove('mainDrawer-open');
            }
            renderActiveTabContent();
        } else {
            virtualPage.style.setProperty('display', 'none', 'important');
        }
    }

    function createVirtualPage() {
        let page = document.getElementById(VIRTUAL_PAGE_ID);
        if (page) return page;

        page = safeCreateElement('div');
        page.id = VIRTUAL_PAGE_ID;
        page.className = 'jf-custom-stats-page';
        page.setAttribute('data-role', 'page');
        page.setAttribute('data-title', 'Server Statistics');
        page.setAttribute('data-backbutton', 'true');
        page.setAttribute('data-menubutton', 'false');

        page.innerHTML = `
            <div class="mui-appbar">
                <div class="mui-header-content">
                    <button class="mui-back-button" id="jf-stats-back-btn" style="background:none; border:none; color:#ffffff; cursor:pointer; padding:4px; display: flex; align-items: center;">
                        <span class="material-icons" style="font-size: 24px;">arrow_back</span>
                    </button>
                    <h2 class="mui-header-title">Server Statistics</h2>
                    <span class="material-icons" style="color: #00a4dc; font-size: 28px;">bar_chart</span>
                </div>
                <div class="mui-tabs">
                    <button class="mui-tab-button active" data-tab="0">
                        <span class="material-icons" style="font-size: 20px; margin-right: 4px;">people</span> User Insights
                    </button>
                    <button class="mui-tab-button" data-tab="1">
                        <span class="material-icons" style="font-size: 20px; margin-right: 4px;">category</span> Categories & Genres
                    </button>
                    <button class="mui-tab-button" data-tab="2">
                        <span class="material-icons" style="font-size: 20px; margin-right: 4px;">star</span> Top Content
                    </button>
                </div>
            </div>
            <div class="mui-content-area" id="jf-stats-content"></div>
        `;

        document.body.appendChild(page);

        page.querySelector('#jf-stats-back-btn').addEventListener('click', () => {
            window.location.hash = '#/home';
        });

        page.querySelectorAll('.mui-tab-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                page.querySelectorAll('.mui-tab-button').forEach(b => b.classList.remove('active'));
                target.classList.add('active');
                activeTab = parseInt(target.getAttribute('data-tab'), 10);
                renderActiveTabContent();
            });
        });

        return page;
    }

    function safeFetch(endpoint, queryParams = {}) {
        const apiClient = getApiClient();
        if (!apiClient) return Promise.resolve(null);
        try {
            const url = apiClient.getUrl(endpoint, queryParams);
            return apiClient.ajax({
                url: url,
                type: 'GET',
                dataType: 'json'
            }).then(
                data => data,
                err => null
            );
        } catch (e) {
            return Promise.resolve(null);
        }
    }

    async function loadStatisticsData() {
        const apiClient = getApiClient();
        if (!apiClient) return formatServerDataset([], [], [], []);

        const currentUserId = apiClient.getCurrentUserId ? apiClient.getCurrentUserId() : "";
        let currentUserName = "You";
        let userStatsList = [];

        const moviesAggregation = {};
        const showsAggregation = {};
        const musicAggregation = {};

        let userList = await safeFetch('Users');
        
        if (!userList || !Array.isArray(userList)) {
            const me = await safeFetch(`Users/${currentUserId}`);
            if (me) {
                userList = [me];
            } else {
                userList = [{ Id: currentUserId, Name: currentUserName }];
            }
        }
        
        if (userList && Array.isArray(userList)) {
            const statsPromises = userList.map(async (user) => {
                const history = await safeFetch(`Users/${user.Id}/Items`, {
                    Recursive: true,
                    Filters: 'IsPlayed',
                    Fields: 'RunTimeTicks,Genres,PlayCount,SeriesName,Album,UserData',
                    IncludeItemTypes: 'Movie,Episode,Audio,Book'
                });

                let parsedUser = {
                    name: user.Name,
                    userId: user.Id,
                    totalHours: 0,
                    totalCompletions: 0,
                    moviesWatched: 0,
                    moviesHours: 0,
                    showsWatched: 0,
                    showsHours: 0,
                    musicWatched: 0,
                    musicHours: 0,
                    booksWatched: 0,
                    booksHours: 0,
                    videoGenres: {},
                    audioGenres: {},
                    bookGenres: {}
                };

                if (user.Id === currentUserId) {
                    currentUserName = user.Name;
                }

                if (history && Array.isArray(history.Items)) {
                    history.Items.forEach(item => {
                        const ticks = item.RunTimeTicks || 0;
                        
                        let plays = 1;
                        if (item.UserData && typeof item.UserData.PlayCount === 'number' && item.UserData.PlayCount > 0) {
                            plays = item.UserData.PlayCount;
                        }

                        const itemHours = (ticks / 36000000000) * plays;
                        parsedUser.totalHours += itemHours;
                        parsedUser.totalCompletions += plays;

                        if (item.Type === 'Movie') {
                            parsedUser.moviesWatched += plays;
                            parsedUser.moviesHours += itemHours;

                            if (!moviesAggregation[item.Id]) {
                                moviesAggregation[item.Id] = { name: item.Name, plays: 0, totalHours: 0 };
                            }
                            moviesAggregation[item.Id].plays += plays;
                            moviesAggregation[item.Id].totalHours += itemHours;

                        } else if (item.Type === 'Episode') {
                            parsedUser.showsWatched += plays;
                            parsedUser.showsHours += itemHours;

                            const seriesKey = item.SeriesName || item.Name || "Unknown Show";
                            if (!showsAggregation[seriesKey]) {
                                showsAggregation[seriesKey] = { name: seriesKey, plays: 0, totalHours: 0 };
                            }
                            showsAggregation[seriesKey].plays += plays;
                            showsAggregation[seriesKey].totalHours += itemHours;

                        } else if (item.Type === 'Audio') {
                            parsedUser.musicWatched += plays;
                            parsedUser.musicHours += itemHours;

                            const trackLabel = `${item.Name} (${item.Album || 'Single'})`;
                            if (!musicAggregation[item.Id]) {
                                musicAggregation[item.Id] = { name: trackLabel, plays: 0, totalHours: 0 };
                            }
                            musicAggregation[item.Id].plays += plays;
                            musicAggregation[item.Id].totalHours += itemHours;

                        } else if (item.Type === 'Book' || item.Type === 'AudioBook') {
                            parsedUser.booksWatched += plays;
                            parsedUser.booksHours += itemHours;
                        }

                        if (Array.isArray(item.Genres)) {
                            item.Genres.forEach(genre => {
                                if (genre) {
                                    if (item.Type === 'Movie' || item.Type === 'Episode') {
                                        parsedUser.videoGenres[genre] = (parsedUser.videoGenres[genre] || 0) + plays;
                                    } else if (item.Type === 'Audio') {
                                        parsedUser.audioGenres[genre] = (parsedUser.audioGenres[genre] || 0) + plays;
                                    } else if (item.Type === 'Book' || item.Type === 'AudioBook') {
                                        parsedUser.bookGenres[genre] = (parsedUser.bookGenres[genre] || 0) + plays;
                                    }
                                }
                            });
                        }
                    });
                }
                return parsedUser;
            });

            userStatsList = await Promise.all(statsPromises);
        }

        const topMoviesList = Object.values(moviesAggregation)
            .sort((a, b) => b.plays - a.plays || b.totalHours - a.totalHours)
            .slice(0, 5)
            .map(m => ({ name: m.name, plays: m.plays, totalHours: parseFloat(m.totalHours.toFixed(1)) }));

        const topShowsList = Object.values(showsAggregation)
            .sort((a, b) => b.plays - a.plays || b.totalHours - a.totalHours)
            .slice(0, 5)
            .map(s => ({ name: s.name, plays: s.plays, totalHours: parseFloat(s.totalHours.toFixed(1)) }));

        const topMusicList = Object.values(musicAggregation)
            .sort((a, b) => b.plays - a.plays || b.totalHours - a.totalHours)
            .slice(0, 5)
            .map(m => ({ name: m.name, plays: m.plays, totalHours: parseFloat(m.totalHours.toFixed(1)) }));

        return formatServerDataset(userStatsList, topMoviesList, topShowsList, topMusicList);
    }

    function formatServerDataset(list, realMovies = [], realShows = [], realMusic = []) {
        const watchers = list.map(u => ({ name: u.name, hours: parseFloat(u.totalHours.toFixed(1)) })).sort((a,b)=>b.hours - a.hours);
        const completions = list.map(u => ({ name: u.name, count: u.totalCompletions })).sort((a,b)=>b.count - a.count);

        let totalMoviesHours = 0, totalMoviesCount = 0;
        let totalShowsHours = 0, totalShowsCount = 0;
        let totalMusicHours = 0, totalMusicCount = 0;
        let totalBooksHours = 0, totalBooksCount = 0;
        let combinedVideoGenres = {};
        let combinedAudioGenres = {};
        let combinedBookGenres = {};

        list.forEach(u => {
            totalMoviesHours += u.moviesHours;
            totalMoviesCount += u.moviesWatched;
            totalShowsHours += u.showsHours;
            totalShowsCount += u.showsWatched;
            totalMusicHours += u.musicHours;
            totalMusicCount += u.musicWatched;
            totalBooksHours += u.booksHours;
            totalBooksCount += u.booksWatched;

            Object.entries(u.videoGenres || {}).forEach(([genre, count]) => {
                combinedVideoGenres[genre] = (combinedVideoGenres[genre] || 0) + count;
            });
            Object.entries(u.audioGenres || {}).forEach(([genre, count]) => {
                combinedAudioGenres[genre] = (combinedAudioGenres[genre] || 0) + count;
            });
            Object.entries(u.bookGenres || {}).forEach(([genre, count]) => {
                combinedBookGenres[genre] = (combinedBookGenres[genre] || 0) + count;
            });
        });

        const sortGenres = (obj) => Object.entries(obj).map(([genre, count]) => ({ genre, count })).sort((a, b) => b.count - a.count).slice(0, 3);

        return {
            users: watchers,
            completions: completions,
            categories: [
                { type: "Movies", hours: parseFloat(totalMoviesHours.toFixed(1)), count: totalMoviesCount },
                { type: "TV Shows", hours: parseFloat(totalShowsHours.toFixed(1)), count: totalShowsCount },
                { type: "Music Tracks", hours: parseFloat(totalMusicHours.toFixed(1)), count: totalMusicCount },
                { type: "Books & Audio", hours: parseFloat(totalBooksHours.toFixed(1)), count: totalBooksCount }
            ],
            genres: {
                video: sortGenres(combinedVideoGenres),
                music: sortGenres(combinedAudioGenres),
                books: sortGenres(combinedBookGenres)
            },
            topItems: {
                movies: realMovies,
                shows: realShows,
                music: realMusic
            }
        };
    }

    async function renderActiveTabContent() {
        const container = document.getElementById('jf-stats-content');
        if (!container) return;

        if (isFetchingData) return;
        isFetchingData = true;

        container.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 60px 0; gap: 16px;">
                <span class="material-icons animate-spin" style="font-size: 48px; color: #00a4dc;">sync</span>
                <span style="font-size: 14px; color: rgba(255, 255, 255, 0.6); font-weight: 500; text-transform: uppercase; letter-spacing: 1px;">
                    Aggregating Library Metrics...
                </span>
            </div>
        `;

        const stats = await loadStatisticsData();
        isFetchingData = false;

        if (activeTab === 0) {
            renderUserInsights(container, stats);
        } else if (activeTab === 1) {
            renderCategoriesBreakdown(container, stats);
        } else if (activeTab === 2) {
            renderTopContentBreakdown(container, stats);
        }
    }

    function renderUserInsights(container, stats) {
        let maxHours = Math.max(...stats.users.map(u => u.hours)) || 1;
        let maxCompletions = Math.max(...stats.completions.map(u => u.count)) || 1;

        let userListHtml = '';
        if (stats.users.length > 0) {
            stats.users.forEach((u, i) => {
                const pct = (u.hours / maxHours) * 100;
                userListHtml += `
                    <div class="mui-list-item">
                        <div class="mui-avatar">${u.name.charAt(0).toUpperCase()}</div>
                        <div class="mui-list-item-content">
                            <p class="mui-list-item-text">${escapeHtml(u.name)}</p>
                            <div class="mui-progress-wrapper">
                                <div class="mui-progress-bar-container">
                                    <div class="mui-progress-bar-fill" style="width: ${pct}%;"></div>
                                </div>
                            </div>
                        </div>
                        <div class="mui-list-item-action">${u.hours}h</div>
                    </div>
                `;
            });
        } else {
            userListHtml = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:48px 16px; gap:12px; opacity:0.5;">
                    <span class="material-icons" style="font-size:40px;">person_off</span>
                    <p style="font-size:13px; margin:0;">No viewer playtimes logged.</p>
                </div>
            `;
        }

        let completionListHtml = '';
        if (stats.completions.length > 0) {
            stats.completions.forEach((u, i) => {
                const pct = (u.count / maxCompletions) * 100;
                completionListHtml += `
                    <div class="mui-list-item">
                        <div class="mui-avatar" style="border-color:#f48fb1; color:#f48fb1; background-color:rgba(244,143,177,0.15);">${u.name.charAt(0).toUpperCase()}</div>
                        <div class="mui-list-item-content">
                            <p class="mui-list-item-text">${escapeHtml(u.name)}</p>
                            <div class="mui-progress-wrapper">
                                <div class="mui-progress-bar-container">
                                    <div class="mui-progress-bar-fill" style="width: ${pct}%; background-color:#f48fb1;"></div>
                                </div>
                            </div>
                        </div>
                        <div class="mui-list-item-action" style="color:#f48fb1;">${u.count}</div>
                    </div>
                `;
            });
        } else {
            completionListHtml = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:48px 16px; gap:12px; opacity:0.5;">
                    <span class="material-icons" style="font-size:40px;">history_toggle_off</span>
                    <p style="font-size:13px; margin:0;">No completed files logged.</p>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="mui-grid">
                <div class="mui-paper">
                    <div class="mui-card-header">
                        <span class="material-icons" style="color: #00a4dc;">access_time</span>
                        <h3 class="mui-card-title">Watch Time Leaderboard</h3>
                    </div>
                    <div>${userListHtml}</div>
                </div>
                <div class="mui-paper">
                    <div class="mui-card-header">
                        <span class="material-icons" style="color: #f48fb1;">check_circle</span>
                        <h3 class="mui-card-title">Completed Items</h3>
                    </div>
                    <div>${completionListHtml}</div>
                </div>
            </div>
        `;
    }

    function renderCategoriesBreakdown(container, stats) {
        let maxHours = Math.max(...stats.categories.map(c => c.hours)) || 1;
        let totalStatsHours = stats.categories.reduce((acc, c) => acc + c.hours, 0);

        let listHtml = '';
        let hasCategoriesData = totalStatsHours > 0;

        if (hasCategoriesData) {
            stats.categories.forEach(cat => {
                const pct = (cat.hours / maxHours) * 100;
                const share = totalStatsHours > 0 ? ((cat.hours / totalStatsHours) * 100).toFixed(0) : 0;
                
                let icon = 'folder';
                if (cat.type.includes('Movies')) icon = 'movie';
                if (cat.type.includes('Shows')) icon = 'tv';
                if (cat.type.includes('Music')) icon = 'music_note';
                if (cat.type.includes('Books')) icon = 'book';

                listHtml += `
                    <div class="mui-list-item">
                        <div class="mui-avatar" style="border-color:#a5d6a7; color:#a5d6a7; background-color:rgba(165,214,167,0.15);">
                            <span class="material-icons" style="font-size:20px;">${icon}</span>
                        </div>
                        <div class="mui-list-item-content">
                            <p class="mui-list-item-text">${cat.type}</p>
                            <p class="mui-list-item-subtext">${cat.count} items completed (${share}% share)</p>
                            <div class="mui-progress-wrapper">
                                <div class="mui-progress-bar-container">
                                    <div class="mui-progress-bar-fill" style="width: ${pct}%; background-color:#a5d6a7;"></div>
                                </div>
                            </div>
                        </div>
                        <div class="mui-list-item-action" style="color:#a5d6a7;">${cat.hours}h</div>
                    </div>
                `;
            });
        } else {
            listHtml = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:64px 16px; gap:12px; opacity:0.5;">
                    <span class="material-icons" style="font-size:44px;">folder_off</span>
                    <p style="font-size:13px; margin:0; font-weight: 500;">No media classification statistics available.</p>
                </div>
            `;
        }

        let genresHtml = '';
        const hasAnyGenres = stats.genres.video.length > 0 || stats.genres.music.length > 0 || stats.genres.books.length > 0;

        if (hasAnyGenres) {
            function buildGenreSection(title, genreList, icon, color) {
                if (!genreList || genreList.length === 0) return '';
                let maxCount = Math.max(...genreList.map(g => g.count)) || 1;
                let html = `<div style="font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin: 16px 0 8px 16px;">${title}</div>`;
                
                genreList.forEach(g => {
                    const genrePct = (g.count / maxCount) * 100;
                    html += `
                        <div class="mui-list-item" style="padding: 8px 16px;">
                            <div class="mui-avatar" style="width: 32px; height: 32px; border-color:${color}; color:${color}; background-color:rgba(255,255,255,0.05);">
                                <span class="material-icons" style="font-size:16px;">${icon}</span>
                            </div>
                            <div class="mui-list-item-content">
                                <p class="mui-list-item-text" style="font-size: 13px;">${escapeHtml(g.genre)}</p>
                                <div class="mui-progress-wrapper" style="margin-top: 4px;">
                                    <div class="mui-progress-bar-container" style="height: 4px;">
                                        <div class="mui-progress-bar-fill" style="width: ${genrePct}%; background-color:${color};"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="mui-list-item-action" style="font-size: 12px; color:${color};">${g.count}</div>
                        </div>
                    `;
                });
                return html;
            }

            genresHtml += buildGenreSection('Video (Movies & TV)', stats.genres.video, 'movie', '#ffe082');
            genresHtml += buildGenreSection('Audio (Music)', stats.genres.music, 'music_note', '#b39ddb');
            genresHtml += buildGenreSection('Books & Lit', stats.genres.books, 'book', '#a5d6a7');

        } else {
            genresHtml = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:64px 16px; gap:12px; opacity:0.5;">
                    <span class="material-icons" style="font-size:44px;">bubble_chart</span>
                    <p style="font-size:13px; margin:0; font-weight: 500;">No genre playback records matched.</p>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="mui-grid">
                <div class="mui-paper">
                    <div class="mui-card-header">
                        <span class="material-icons" style="color: #a5d6a7;">pie_chart</span>
                        <h3 class="mui-card-title">Consumption By Category</h3>
                    </div>
                    <div>${listHtml}</div>
                </div>
                <div class="mui-paper">
                    <div class="mui-card-header">
                        <span class="material-icons" style="color: #ffe082;">grain</span>
                        <h3 class="mui-card-title">Top Played Genres</h3>
                    </div>
                    <div>${genresHtml}</div>
                </div>
            </div>
        `;
    }

    function renderTopContentBreakdown(container, stats) {
        let movieHtml = '';
        if (stats.topItems.movies.length > 0) {
            stats.topItems.movies.forEach((item, index) => {
                movieHtml += `
                    <div class="mui-list-item">
                        <div class="mui-avatar" style="width: 28px; height: 28px; font-size: 12px;">${index + 1}</div>
                        <div class="mui-list-item-content">
                            <p class="mui-list-item-text" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</p>
                            <p class="mui-list-item-subtext">${item.plays} plays</p>
                        </div>
                        <div class="mui-list-item-action" style="font-size: 14px;">${item.totalHours}h</div>
                    </div>
                `;
            });
        } else {
            movieHtml = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:48px 16px; gap:12px; opacity:0.5;">
                    <span class="material-icons" style="font-size:36px;">movie</span>
                    <p style="font-size:13px; margin:0;">No dynamic movie logs registered.</p>
                </div>
            `;
        }

        let tvHtml = '';
        if (stats.topItems.shows.length > 0) {
            stats.topItems.shows.forEach((item, index) => {
                tvHtml += `
                    <div class="mui-list-item">
                        <div class="mui-avatar" style="width: 28px; height: 28px; font-size: 12px; border-color:#ffe082; color:#ffe082; background-color:rgba(255,224,130,0.15);">${index + 1}</div>
                        <div class="mui-list-item-content">
                            <p class="mui-list-item-text" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</p>
                            <p class="mui-list-item-subtext">${item.plays} series hits</p>
                        </div>
                        <div class="mui-list-item-action" style="font-size: 14px; color:#ffe082;">${item.totalHours}h</div>
                    </div>
                `;
            });
        } else {
            tvHtml = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:48px 16px; gap:12px; opacity:0.5;">
                    <span class="material-icons" style="font-size:36px;">tv</span>
                    <p style="font-size:13px; margin:0;">No dynamic show logs registered.</p>
                </div>
            `;
        }

        let musicHtml = '';
        if (stats.topItems.music.length > 0) {
            stats.topItems.music.forEach((item, index) => {
                musicHtml += `
                    <div class="mui-list-item">
                        <div class="mui-avatar" style="width: 28px; height: 28px; font-size: 12px; border-color:#b39ddb; color:#b39ddb; background-color:rgba(179,157,219,0.15);">${index + 1}</div>
                        <div class="mui-list-item-content">
                            <p class="mui-list-item-text" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</p>
                            <p class="mui-list-item-subtext">${item.plays} plays</p>
                        </div>
                        <div class="mui-list-item-action" style="font-size: 14px; color:#b39ddb;">${item.totalHours}h</div>
                    </div>
                `;
            });
        } else {
            musicHtml = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:48px 16px; gap:12px; opacity:0.5;">
                    <span class="material-icons" style="font-size:36px;">music_note</span>
                    <p style="font-size:13px; margin:0;">No dynamic audio logs registered.</p>
                </div>
            `;
        }

        container.innerHTML = `
            <div class="mui-grid">
                <div class="mui-paper">
                    <div class="mui-card-header">
                        <span class="material-icons" style="color: #00a4dc;">movie</span>
                        <h3 class="mui-card-title">Top Movies</h3>
                    </div>
                    <div>${movieHtml}</div>
                </div>
                <div class="mui-paper">
                    <div class="mui-card-header">
                        <span class="material-icons" style="color: #ffe082;">tv</span>
                        <h3 class="mui-card-title">Top TV Series</h3>
                    </div>
                    <div>${tvHtml}</div>
                </div>
                <div class="mui-paper">
                    <div class="mui-card-header">
                        <span class="material-icons" style="color: #b39ddb;">music_note</span>
                        <h3 class="mui-card-title">Top Tracks & Albums</h3>
                    </div>
                    <div>${musicHtml}</div>
                </div>
            </div>
        `;
    }

    function injectSidebarLink() {
        if (desktopInjected && mobileInjected) return;

        const generalMenus = document.querySelectorAll('.customMenuOptions');
        generalMenus.forEach(menu => {
            if (menu.querySelector(`.${SIDEBAR_LINK_CLASS}`)) {
                desktopInjected = true;
                return;
            }

            const homeLink = menu.querySelector('a[href="#/home"], a.lnkMediaFolder');
            const anchor = safeCreateElement('a', { is: 'emby-linkbutton' });
            
            anchor.className = `navMenuOption emby-button ${SIDEBAR_LINK_CLASS}`;
            anchor.href = STATS_ROUTE;
            
            anchor.innerHTML = `
                <span class="material-icons navMenuOptionIcon equalizer" aria-hidden="true" style="margin-right: 8px;"></span>
                <span class="navMenuOptionText">Server Statistics</span>
            `;

            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.hash = STATS_ROUTE;
                checkRouteState();
            });

            if (homeLink) {
                homeLink.parentNode.insertBefore(anchor, homeLink.nextSibling);
                desktopInjected = true;
            } else {
                menu.appendChild(anchor);
                desktopInjected = true;
            }
        });

        const drawers = document.querySelectorAll('.mainDrawer-scrollContainer, .sidebarLinks, .slideMenuList');
        drawers.forEach(drawer => {
            if (drawer.querySelector(`.${SIDEBAR_LINK_CLASS}`)) {
                mobileInjected = true;
                return;
            }

            const divider = drawer.querySelector('.sidebarDivider');
            const anchor = safeCreateElement('a');
            
            anchor.className = `sidebarLink ${SIDEBAR_LINK_CLASS}`;
            anchor.href = STATS_ROUTE;
            anchor.style.setProperty('display', 'flex', 'important');
            anchor.style.setProperty('align-items', 'center', 'important');
            anchor.style.setProperty('gap', '12px', 'important');
            
            anchor.innerHTML = `
                <span class="material-icons sidebarLinkIcon" style="font-size: 20px;">bar_chart</span>
                <span class="sidebarLinkText">Server Statistics</span>
            `;

            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.hash = STATS_ROUTE;
                checkRouteState();
            });

            if (divider && divider.nextSibling) {
                drawer.insertBefore(anchor, divider.nextSibling);
                mobileInjected = true;
            } else {
                drawer.appendChild(anchor);
                mobileInjected = true;
            }
        });
    }

    function checkRouteState() {
        const isCurrentlyStats = window.location.hash === STATS_ROUTE;
        
        if (isCurrentlyStats) {
            if (currentRouteState !== 'stats') {
                currentRouteState = 'stats';
                toggleVirtualPage(true);
            }
        } else {
            if (currentRouteState === 'stats' || currentRouteState === null) {
                currentRouteState = 'other';
                toggleVirtualPage(false);
            }
        }
    }

    function checkTitleState() {
        const titleEl = document.querySelector('title');
        if (titleEl && window.location.hash === STATS_ROUTE && titleEl.innerText !== 'Server Statistics') {
            titleEl.innerText = 'Server Statistics';
            const titleObserver = new MutationObserver(() => {
                if (window.location.hash === STATS_ROUTE) {
                    if (titleEl.innerText !== 'Server Statistics') {
                        titleEl.innerText = 'Server Statistics';
                    }
                } else {
                    titleObserver.disconnect();
                }
            });
            titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
        }
    }

    window.addEventListener('hashchange', () => {
        checkRouteState();
        checkTitleState();
    });
    window.addEventListener('popstate', () => {
        checkRouteState();
        checkTitleState();
    });

    const observer = new MutationObserver(() => {
        if (desktopInjected && mobileInjected) {
            observer.disconnect();
            return;
        }

        if (observerFrameId) return;
        observerFrameId = requestAnimationFrame(() => {
            injectSidebarLink();
            observerFrameId = null;
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    requestAnimationFrame(() => {
        injectSidebarLink();
        checkRouteState();
        checkTitleState();
    });
})();
