// Amplifies audio up to 300% and provides a 10-band Equalizer.
// Strictly ES5 compliant. Works on local browser playback only.

(function() {
    var audioCtx = null;
    var gainNode = null;
    var source = null;
    var filters = [];
    var lastVideoElement = null;

    var BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    
    var PRESETS = {
        'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        'Bass Boost': [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
        'Treble Boost': [0, 0, 0, 0, 0, 2, 4, 6, 8, 8],
        'Balanced': [3, 2, 0, -1, -2, -1, 0, 2, 3, 3],
        'Loudness': [5, 3, 0, 0, 0, 0, 0, 3, 5, 2],
        'Vocal': [-2, -2, -1, 0, 2, 4, 4, 2, 0, -2]
    };

    function getSavedBoost() {
        var val = localStorage.getItem('jf-audio-boost');
        return val ? parseFloat(val) : 1.0;
    }

    function getSavedEQ() {
        var val = localStorage.getItem('jf-audio-eq');
        return val ? JSON.parse(val) : PRESETS['Flat'];
    }

    function injectStyles() {
        if (document.getElementById('jf-booster-css')) return;
        var s = document.createElement('style');
        s.id = 'jf-booster-css';
        s.innerHTML = 
            '#jf-boost-modal { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); z-index: 999999; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.2s; font-family: sans-serif; } ' +
            '#jf-boost-modal.active { opacity: 1; pointer-events: auto; } ' +
            '.jf-boost-card { background: var(--theme-background, #1a1a1a); padding: 25px; border-radius: 12px; width: 480px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 40px rgba(0,0,0,0.8); color: #fff; transform: scale(0.9); transition: transform 0.2s; } ' +
            '#jf-boost-modal.active .jf-boost-card { transform: scale(1); } ' +
            
            '.jf-modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; } ' +
            '.jf-modal-title { margin: 0; font-size: 1.2rem; font-weight: normal; color: var(--theme-primary-color, #00a4dc); } ' +
            
            '.jf-section { margin-bottom: 25px; background: rgba(255,255,255,0.03); padding: 15px; border-radius: 8px; } ' +
            '.jf-section-title { font-size: 0.8rem; text-transform: uppercase; color: #888; margin-bottom: 15px; display: flex; justify-content: space-between; } ' +
            '.jf-boost-row { display: flex; align-items: center; gap: 15px; } ' +
            '.jf-slider { flex: 1; -webkit-appearance: none; height: 4px; background: #444; border-radius: 2px; outline: none; } ' +
            '.jf-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; background: var(--theme-primary-color, #00a4dc); border-radius: 50%; cursor: pointer; border: 2px solid #fff; } ' +
            '.jf-btn-reset { background: rgba(255,255,255,0.1); border: none; color: #fff; padding: 4px 10px; border-radius: 4px; font-size: 0.7rem; cursor: pointer; } ' +
            '.jf-btn-reset:hover { background: rgba(255,255,255,0.2); } ' +
            
            '.jf-eq-grid { display: flex; justify-content: space-between; height: 130px; margin-bottom: 10px; padding: 0 5px; } ' +
            '.jf-eq-col { flex: 1; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; } ' +
            '.jf-eq-slider { position: absolute; top: 40px; -webkit-appearance: none; width: 85px; height: 4px; background: #333; transform: rotate(-90deg); outline: none; margin: 0; } ' +
            '.jf-eq-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; background: var(--theme-primary-color, #00a4dc); border-radius: 50%; cursor: pointer; } ' +
            '.jf-eq-label { font-size: 0.65rem; color: #666; margin-top: 5px; text-align: center; width: 100%; } ' +
            
            '.jf-preset-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 15px; } ' +
            '.jf-preset-btn { background: #222; border: 1px solid #444; color: #aaa; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; cursor: pointer; transition: all 0.2s; } ' +
            '.jf-preset-btn.active { border-color: var(--theme-primary-color, #00a4dc); color: var(--theme-primary-color, #00a4dc); background: rgba(0,164,220,0.1); } ';
        document.head.appendChild(s);
    }

    function initAudio(video) {
        if (!video || lastVideoElement === video) return;
        
        try {
            if (!audioCtx) {
                var AudioContext = window.AudioContext || window.webkitAudioContext;
                audioCtx = new AudioContext();
            }
            if (audioCtx.state === 'suspended') audioCtx.resume();
            if (source) { try { source.disconnect(); } catch(e) {} }

            source = audioCtx.createMediaElementSource(video);
            gainNode = audioCtx.createGain();
            gainNode.gain.value = getSavedBoost();

            filters = [];
            var savedEQ = getSavedEQ();
            var lastNode = source;

            for (var i = 0; i < BANDS.length; i++) {
                var filter = audioCtx.createBiquadFilter();
                filter.type = (i === 0) ? "lowshelf" : (i === BANDS.length - 1) ? "highshelf" : "peaking";
                filter.frequency.value = BANDS[i];
                filter.Q.value = 1;
                filter.gain.value = savedEQ[i];
                lastNode.connect(filter);
                lastNode = filter;
                filters.push(filter);
            }

            lastNode.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            lastVideoElement = video;
        } catch (err) {
            console.error("Audio Booster init error:", err);
        }
    }

    function updateUI() {
        var b = getSavedBoost();
        var eq = getSavedEQ();
        
        var boostSlider = document.getElementById('jf-boost-range');
        var boostLabel = document.getElementById('jf-boost-text');
        if (boostSlider) boostSlider.value = b;
        if (boostLabel) boostLabel.innerText = Math.round(b * 100) + '%';

        for (var i = 0; i < BANDS.length; i++) {
            var s = document.getElementById('jf-eq-' + i);
            if (s) s.value = eq[i];
        }

        var btns = document.querySelectorAll('.jf-preset-btn');
        var currentPreset = "Custom";
        for (var key in PRESETS) {
            if (JSON.stringify(PRESETS[key]) === JSON.stringify(eq)) {
                currentPreset = key;
                break;
            }
        }
        for (var j = 0; j < btns.length; j++) {
            btns[j].classList.toggle('active', btns[j].innerText === currentPreset);
        }
    }

    window.jfSetBoost = function(val) {
        var v = parseFloat(val);
        if (gainNode) gainNode.gain.value = v;
        localStorage.setItem('jf-audio-boost', v);
        document.getElementById('jf-boost-text').innerText = Math.round(v * 100) + '%';
    };

    window.jfResetBoost = function() {
        var slider = document.getElementById('jf-boost-range');
        if (slider) slider.value = 1.0;
        window.jfSetBoost(1.0);
    };

    window.jfSetEQ = function(index, val) {
        var v = parseFloat(val);
        if (filters[index]) filters[index].gain.value = v;
        var eq = getSavedEQ();
        eq[index] = v;
        localStorage.setItem('jf-audio-eq', JSON.stringify(eq));
        updateUI();
    };

    window.jfApplyPreset = function(name) {
        var vals = PRESETS[name];
        if (!vals) return;
        localStorage.setItem('jf-audio-eq', JSON.stringify(vals));
        for (var i = 0; i < filters.length; i++) {
            if (filters[i]) filters[i].gain.value = vals[i];
        }
        updateUI();
    };

    function injectModal() {
        if (document.getElementById('jf-boost-modal')) return;
        
        var modal = document.createElement('div');
        modal.id = 'jf-boost-modal';
        modal.addEventListener('click', function() { modal.classList.remove('active'); });

        var eqSliders = '';
        for (var i = 0; i < BANDS.length; i++) {
            var label = BANDS[i] >= 1000 ? (BANDS[i]/1000) + 'k' : BANDS[i];
            eqSliders += '<div class="jf-eq-col">' +
                         '<input type="range" id="jf-eq-' + i + '" class="jf-eq-slider" min="-12" max="12" step="0.5" oninput="window.jfSetEQ(' + i + ', this.value)">' +
                         '<div class="jf-eq-label">' + label + '</div>' +
                         '</div>';
        }

        var presetBtns = '';
        var pNames = Object.keys(PRESETS);
        for (var j = 0; j < pNames.length; j++) {
            presetBtns += '<button class="jf-preset-btn" onclick="window.jfApplyPreset(\'' + pNames[j] + '\')">' + pNames[j] + '</button>';
        }

        modal.innerHTML = 
            '<div class="jf-boost-card" onclick="event.stopPropagation()">' +
                '<div class="jf-modal-header">' +
                    '<h2 class="jf-modal-title">Audio Studio</h2>' +
                    '<button class="jf-btn-reset" onclick="document.getElementById(\'jf-boost-modal\').classList.remove(\'active\')">Close</button>' +
                '</div>' +
                '<div class="jf-section">' +
                    '<div class="jf-section-title">Volume Booster <button class="jf-btn-reset" onclick="window.jfResetBoost()">Reset</button></div>' +
                    '<div class="jf-boost-row">' +
                        '<span class="material-icons" style="font-size:18px; color:#888;">volume_up</span>' +
                        '<input type="range" id="jf-boost-range" class="jf-slider" min="1" max="10" step="0.1" oninput="window.jfSetBoost(this.value)">' +
                        '<span id="jf-boost-text" class="jf-boost-label">100%</span>' +
                    '</div>' +
                '</div>' +
                '<div class="jf-section" style="margin-bottom:10px;">' +
                    '<div class="jf-section-title">10-Band Equalizer</div>' +
                    '<div class="jf-eq-grid">' + eqSliders + '</div>' +
                    '<div class="jf-preset-row">' + presetBtns + '</div>' +
                '</div>' +
            '</div>';
            
        document.body.appendChild(modal);
    }

    function monitorPlayer() {
        var isVideoPage = window.location.hash.indexOf('video') !== -1;
        var existingBtn = document.getElementById('jf-boost-btn-wrap');

        if (!isVideoPage) {
            if (existingBtn && existingBtn.parentNode) existingBtn.parentNode.removeChild(existingBtn);
            var modal = document.getElementById('jf-boost-modal');
            if (modal) modal.classList.remove('active');
            return;
        }

        var video = document.querySelector('video') || document.querySelector('.htmlvideoplayer');
        if (!video) return;

        initAudio(video);
        injectModal();

        if (existingBtn) return;

        var osdContainers = document.querySelectorAll('.buttons.focuscontainer-x');
        
        for (var i = 0; i < osdContainers.length; i++) {
            var container = osdContainers[i];
            if (container.querySelector('#jf-boost-btn-wrap')) continue;

            var btn = document.createElement('button');
            btn.id = 'jf-boost-btn-wrap';
            btn.setAttribute('is', 'paper-icon-button-light');
            btn.className = 'paper-icon-button-light btnAudioBooster autoSize paper-icon-button-light';
            btn.title = 'Audio Booster & EQ';
            btn.innerHTML = '<span class="largePaperIconButton material-icons graphic_eq" aria-hidden="true"></span>';
            
            btn.onclick = function(e) {
                e.stopPropagation();
                e.preventDefault();
                updateUI();
                document.getElementById('jf-boost-modal').classList.add('active');
            };

            var settingsBtn = container.querySelector('.btnVideoOsdSettings');
            if (settingsBtn) {
                container.insertBefore(btn, settingsBtn);
            } else {
                container.appendChild(btn);
            }
        }
    }

    function start() {
        injectStyles();
        
        var observer = new MutationObserver(function() {
            monitorPlayer();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        
        monitorPlayer();
    }

    window.addEventListener('click', function() {
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    }, { once: true });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
