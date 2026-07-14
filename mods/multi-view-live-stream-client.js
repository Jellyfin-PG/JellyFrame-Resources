(function() {
    var hlsInstances = {};
    var availableChannels = [];
    var currentLayout = 4;
    var activeGridCells = [];

    function isUserLoggedIn() {
        return window.ApiClient && window.ApiClient._currentUser && window.ApiClient._currentUser.Id;
    }

    function loadHlsJs(callback) {
        if (window.Hls) {
            callback();
            return;
        }
        var script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
        script.onload = callback;
        script.onerror = function() {
            showError("Failed to load HLS.js script from CDN.");
        };
        document.head.appendChild(script);
    }

    function showError(msg) {
        var errorBanner = document.createElement('div');
        errorBanner.innerText = msg;
        errorBanner.setAttribute('style', 'position:fixed; top:20px; left:50%; transform:translateX(-50%); background:red; color:white; padding:10px 20px; z-index:999999; border-radius:8px;');
        document.body.appendChild(errorBanner);
        setTimeout(function(){ errorBanner.remove(); }, 4000);
    }

    function injectLiveTvButton() {
        if (!isUserLoggedIn()) return;

        if (window.location.hash.indexOf('#/livetv') === -1) return;

        var liveTvContainers = document.querySelectorAll('.liveTvContainer');
        for (var i = 0; i < liveTvContainers.length; i++) {
            var container = liveTvContainers[i];
            
            if (container.querySelector('.jf-multiview-full-btn')) {
                continue;
            }

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.setAttribute('is', 'emby-button');
            btn.className = 'jf-multiview-full-btn raised emby-button';
            btn.title = 'Live TV Multi-View';
            
            btn.setAttribute('style', 'width: calc(100% - 80px); margin: 10px 40px 20px 40px; box-sizing: border-box; display: block; padding: 12px;');
            
            btn.innerHTML = '<div class="emby-button-foreground" style="display: flex; align-items: center; justify-content: center; gap: 8px;"><span class="material-icons grid_view" style="font-size: 20px;" aria-hidden="true"></span><span>Launch Live TV Multi-View</span></div>';

            container.insertBefore(btn, container.firstChild);

            btn.onclick = function() {
                if (document.getElementById('jf-multiview-wrapper')) return;
                
                var nativeVideo = document.querySelector('video.html5-video-player');
                if (nativeVideo) nativeVideo.pause();

                startMultiView();
            };
        }
    }

    function startMultiView() {
        var userId = window.ApiClient._currentUser.Id;
        var token = window.ApiClient.accessToken();
        var serverUrl = window.ApiClient.serverAddress();
        
        var url = serverUrl + '/LiveTv/Channels?UserId=' + userId + '&Limit=100&api_key=' + token + '&SortBy=SortName';

        fetch(url)
            .then(function(r) { return r.json(); })
            .then(function(result) {
                availableChannels = result.Items;
                if (!availableChannels || availableChannels.length === 0) {
                    showError("No Live TV channels found.");
                    return;
                }

                loadHlsJs(function() {
                    buildMultiViewUI();
                });
            })
            .catch(function(e) {
                showError("Network error fetching TV Channels.");
            });
    }

    function updateLayoutButtonStyles(selected) {
        var btn1 = document.getElementById('btn-layout-1');
        var btn2 = document.getElementById('btn-layout-2');
        var btn4 = document.getElementById('btn-layout-4');
        if (!btn1 || !btn2 || !btn4) return;

        var buttons = [btn1, btn2, btn4];
        buttons.forEach(function(btn) {
            btn.style.background = '#222';
            btn.style.borderColor = '#444';
        });

        var activeBtn = document.getElementById('btn-layout-' + selected);
        if (activeBtn) {
            activeBtn.style.background = '#00a4dc';
            activeBtn.style.borderColor = '#00a4dc';
        }
    }

    function buildMultiViewUI() {
        var wrapper = document.createElement('div');
        wrapper.id = 'jf-multiview-wrapper';
        wrapper.setAttribute('style', 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:black; z-index:100000; display:flex; flex-direction:column;');

        var toolbar = document.createElement('div');
        toolbar.setAttribute('style', 'height:50px; background:#111; display:flex; justify-content:space-between; align-items:center; padding:0 20px; border-bottom:1px solid #333; flex-shrink:0;');
        
        var layoutControls = document.createElement('div');
        layoutControls.innerHTML = 
            '<span style="color:white; margin-right:15px; font-weight:bold; font-family:sans-serif;">Layout:</span>' +
            '<button id="btn-layout-1" style="background:#222; color:white; border:1px solid #444; padding:5px 15px; border-radius:4px; margin-right:10px; cursor:pointer; font-weight:bold;">1 Pane</button>' +
            '<button id="btn-layout-2" style="background:#222; color:white; border:1px solid #444; padding:5px 15px; border-radius:4px; margin-right:10px; cursor:pointer; font-weight:bold;">2 Panes</button>' +
            '<button id="btn-layout-4" style="background:#00a4dc; color:white; border:1px solid #00a4dc; padding:5px 15px; border-radius:4px; cursor:pointer; font-weight:bold;">4 Panes</button>';
        
        var closeBtn = document.createElement('button');
        closeBtn.innerText = 'Close Multi-View';
        closeBtn.setAttribute('style', 'background:#b30000; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; font-weight:bold;');
        closeBtn.onclick = closeMultiView;

        toolbar.appendChild(layoutControls);
        toolbar.appendChild(closeBtn);
        wrapper.appendChild(toolbar);

        var container = document.createElement('div');
        container.id = 'jf-multiview-grid';
        container.setAttribute('style', 'flex:1; display:grid; grid-template-columns:minmax(0, 1fr) minmax(0, 1fr); grid-template-rows:minmax(0, 1fr) minmax(0, 1fr); gap:2px; background:#000; min-height:0;');
        wrapper.appendChild(container);
        document.body.appendChild(wrapper);

        document.getElementById('btn-layout-1').onclick = function() {
            updateLayoutButtonStyles(1);
            setGridLayout(1);
        };
        document.getElementById('btn-layout-2').onclick = function() {
            updateLayoutButtonStyles(2);
            setGridLayout(2);
        };
        document.getElementById('btn-layout-4').onclick = function() {
            updateLayoutButtonStyles(4);
            setGridLayout(4);
        };

        for (var i = 0; i < 4; i++) {
            var cell = document.createElement('div');
            cell.id = 'jf-multi-cell-' + i;
            cell.setAttribute('style', 'position:relative; width:100%; height:100%; min-width:0; min-height:0; background:#1a1a1a; display:flex; align-items:center; justify-content:center; overflow:hidden;');
            container.appendChild(cell);
            activeGridCells.push(cell);
            renderEmptyCell(i);
        }
        
        setGridLayout(currentLayout);
        updateLayoutButtonStyles(currentLayout);
    }

    function setGridLayout(panes) {
        currentLayout = panes;
        var grid = document.getElementById('jf-multiview-grid');
        if (!grid) return;

        if (panes === 1) {
            grid.style.gridTemplateColumns = 'minmax(0, 1fr)';
            grid.style.gridTemplateRows = 'minmax(0, 1fr)';
            activeGridCells[0].style.display = 'flex';
            activeGridCells[1].style.display = 'none';
            activeGridCells[2].style.display = 'none';
            activeGridCells[3].style.display = 'none';
        } else if (panes === 2) {
            grid.style.gridTemplateColumns = 'minmax(0, 1fr)';
            grid.style.gridTemplateRows = 'minmax(0, 1fr) minmax(0, 1fr)';
            activeGridCells[0].style.display = 'flex';
            activeGridCells[1].style.display = 'flex';
            activeGridCells[2].style.display = 'none';
            activeGridCells[3].style.display = 'none';
        } else {
            grid.style.gridTemplateColumns = 'minmax(0, 1fr) minmax(0, 1fr)';
            grid.style.gridTemplateRows = 'minmax(0, 1fr) minmax(0, 1fr)';
            activeGridCells[0].style.display = 'flex';
            activeGridCells[1].style.display = 'flex';
            activeGridCells[2].style.display = 'flex';
            activeGridCells[3].style.display = 'flex';
        }
    }

    function renderEmptyCell(index) {
        var cell = activeGridCells[index];
        cell.innerHTML = '';
        
        if (hlsInstances[index]) {
            hlsInstances[index].destroy();
            delete hlsInstances[index];
        }

        var btn = document.createElement('button');
        btn.innerText = '+ Select Channel';
        btn.setAttribute('style', 'background:rgba(255,255,255,0.1); color:white; border:1px solid rgba(255,255,255,0.2); padding:15px 30px; font-size:16px; border-radius:8px; cursor:pointer; font-weight:bold; transition: background 0.2s;');
        btn.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.2)'; };
        btn.onmouseout = function() { this.style.background = 'rgba(255,255,255,0.1)'; };
        
        btn.onclick = function() {
            showChannelPicker(index);
        };
        
        cell.appendChild(btn);
    }

    function showChannelPicker(index) {
        var cell = activeGridCells[index];
        cell.innerHTML = '';
        
        var listContainer = document.createElement('div');
        listContainer.setAttribute('style', 'width:100%; height:100%; overflow-y:auto; padding:20px; box-sizing:border-box; background:#111; display:flex; flex-direction:column; gap:5px;');

        var header = document.createElement('div');
        header.innerHTML = '<span style="color:white; font-weight:bold;">Select Channel</span>' +
                           '<span style="float:right; color:#888; cursor:pointer;">&times; Cancel</span>';
        header.setAttribute('style', 'padding-bottom:10px; border-bottom:1px solid #333; margin-bottom:10px; font-family:sans-serif; flex-shrink:0;');
        header.querySelector('span:last-child').onclick = function() { renderEmptyCell(index); };
        listContainer.appendChild(header);

        for (var i = 0; i < availableChannels.length; i++) {
            (function(channel) {
                var item = document.createElement('div');
                item.innerText = channel.Name;
                item.setAttribute('style', 'padding:10px; background:#222; color:white; cursor:pointer; border-radius:4px; font-family:sans-serif; font-size:14px; flex-shrink:0;');
                item.onmouseover = function() { this.style.background = '#00a4dc'; };
                item.onmouseout = function() { this.style.background = '#222'; };
                item.onclick = function() {
                    loadChannelIntoCell(index, channel);
                };
                listContainer.appendChild(item);
            })(availableChannels[i]);
        }

        cell.appendChild(listContainer);
    }

    function loadChannelIntoCell(index, channel) {
        var cell = activeGridCells[index];
        cell.innerHTML = '<div style="color:#aaa; font-family:sans-serif;">Loading ' + channel.Name + '...</div>';

        var userId = window.ApiClient._currentUser.Id;
        var token = window.ApiClient.accessToken();
        var serverUrl = window.ApiClient.serverAddress();

        var pbInfoUrl = serverUrl + '/Items/' + channel.Id + '/PlaybackInfo?UserId=' + userId + '&api_key=' + token;
        
        var profileData = {
            DeviceProfile: {
                MaxStreamingBitrate: 8000000,
                DirectPlayProfiles: [{ Type: 'Video', Container: 'mp4,m4v' }],
                TranscodingProfiles: [
                    { Container: 'ts', Type: 'Video', AudioCodec: 'aac', VideoCodec: 'h264', Context: 'Streaming', Protocol: 'hls' }
                ]
            }
        };

        fetch(pbInfoUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData)
        })
        .then(function(r) { return r.json(); })
        .then(function(info) {
            if (!info || !info.MediaSources || info.MediaSources.length === 0) {
                renderEmptyCell(index);
                showError("Failed to get playback info for " + channel.Name);
                return;
            }

            var source = info.MediaSources[0];
            var streamUrl = "";
            
            if (source.TranscodingUrl) {
                streamUrl = serverUrl + source.TranscodingUrl;
            } else {
                streamUrl = serverUrl + '/Videos/' + channel.Id + '/stream.m3u8?MediaSourceId=' + source.Id;
            }

            if (streamUrl.indexOf('api_key') === -1) {
                streamUrl += (streamUrl.indexOf('?') > -1 ? '&' : '?') + 'api_key=' + token;
            }

            renderVideoPlayer(index, channel.Name, streamUrl);
        })
        .catch(function(e) {
            renderEmptyCell(index);
            showError("Network error launching " + channel.Name);
        });
    }

    function renderVideoPlayer(index, channelName, streamUrl) {
        var cell = activeGridCells[index];
        cell.innerHTML = '';

        var title = document.createElement('div');
        title.innerText = channelName;
        title.setAttribute('style', 'position:absolute; top:10px; left:10px; background:rgba(0,0,0,0.7); color:white; padding:5px 10px; border-radius:4px; font-family:sans-serif; z-index:10; pointer-events:none; font-weight:bold;');
        cell.appendChild(title);

        var closeOverlay = document.createElement('div');
        closeOverlay.innerHTML = '&times;';
        closeOverlay.setAttribute('style', 'position:absolute; top:10px; right:10px; background:rgba(0,0,0,0.7); color:white; padding:0px 10px; font-size:24px; border-radius:4px; cursor:pointer; font-family:sans-serif; z-index:10; line-height:1.2;');
        closeOverlay.title = "Close Channel";
        closeOverlay.onclick = function(e) {
            e.stopPropagation();
            renderEmptyCell(index);
        };
        cell.appendChild(closeOverlay);

        var video = document.createElement('video');
        video.id = 'jf-multi-video-' + index;
        video.muted = true;
        video.autoplay = true;
        video.setAttribute('style', 'width:100%; height:100%; object-fit:cover; cursor:pointer; box-sizing:border-box; border:4px solid transparent; transition: border 0.2s;');
        
        video.onclick = function() {
            for (var j = 0; j < 4; j++) {
                var v = document.getElementById('jf-multi-video-' + j);
                if (v) {
                    v.muted = true;
                    v.style.borderColor = 'transparent';
                }
            }
            video.muted = false;
            video.style.borderColor = '#00a4dc';
        };

        cell.appendChild(video);

        if (window.Hls.isSupported()) {
            var hls = new window.Hls({
                maxBufferLength: 15,
                liveSyncDurationCount: 3
            });
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(window.Hls.Events.MANIFEST_PARSED, function() {
                video.play().catch(function(){});
            });
            hlsInstances[index] = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', function() {
                video.play().catch(function(){});
            });
        }
    }

    function closeMultiView() {
        for (var i = 0; i < 4; i++) {
            if (hlsInstances[i]) {
                hlsInstances[i].destroy();
            }
        }
        hlsInstances = {};
        activeGridCells = [];

        var wrapper = document.getElementById('jf-multiview-wrapper');
        if (wrapper) wrapper.remove();
    }

    var initTimerCount = 0;
    var initTimer = setInterval(function() {
        if (document.querySelector('.jf-multiview-full-btn')) {
            clearInterval(initTimer);
        } else {
            injectLiveTvButton();
        }
        if (++initTimerCount > 30) clearInterval(initTimer);
    }, 100);

    setInterval(injectLiveTvButton, 1000);

})();
