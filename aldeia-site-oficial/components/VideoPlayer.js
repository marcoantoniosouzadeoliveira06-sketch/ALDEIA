/* ============================================================
   ALDEIA — COMPONENTE PLAYER DE VÍDEO CUSTOMIZADO (ZERO LAG)
   ============================================================ */

window.createAldeiaVideoPlayer = function (targetEl, options = {}) {
    if (!targetEl) return null;

    const videoSrc = options.src || '';
    const format = options.format || 'post'; // 'post', 'story', 'video'
    const poster = options.poster || '';
    const autoplay = options.autoplay !== false;

    // Container HTML
    const formatClass = format === 'story' ? 'format-story' : (format === 'video' ? 'format-video' : 'format-post');
    targetEl.innerHTML = `
        <div class="aldeia-video-container ${formatClass} is-paused">
            <video class="aldeia-video-element" src="${videoSrc}" poster="${poster}" playsinline ${autoplay ? 'autoplay loop muted' : ''}></video>
            
            <div class="aldeia-video-overlay-play is-paused">
                <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>

            <div class="aldeia-video-controls">
                <div class="aldeia-video-timeline-wrap">
                    <div class="aldeia-video-timeline-track">
                        <div class="aldeia-video-timeline-buffered"></div>
                        <div class="aldeia-video-timeline-progress">
                            <div class="aldeia-video-timeline-handle"></div>
                        </div>
                    </div>
                </div>

                <div class="aldeia-video-row">
                    <div class="aldeia-video-left-controls">
                        <button class="aldeia-video-btn aldeia-btn-play" title="Play/Pause (Espaço)">
                            <svg class="icon-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            <svg class="icon-pause" viewBox="0 0 24 24" style="display:none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        </button>
                        <button class="aldeia-video-btn aldeia-btn-mute" title="Som / Mudo">
                            <svg class="icon-volume" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                            <svg class="icon-mute" viewBox="0 0 24 24" style="display:none;"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                        </button>
                        <span class="aldeia-video-time">00:00 / 00:00</span>
                    </div>

                    <div class="aldeia-video-right-controls">
                        <!-- Velocidade -->
                        <div class="aldeia-video-menu-wrap">
                            <button class="aldeia-video-menu-btn aldeia-btn-speed">1.0x</button>
                            <div class="aldeia-video-menu aldeia-menu-speed">
                                <button class="aldeia-video-menu-item" data-speed="0.5">0.5x</button>
                                <button class="aldeia-video-menu-item" data-speed="0.75">0.75x</button>
                                <button class="aldeia-video-menu-item active" data-speed="1.0">1.0x (Normal)</button>
                                <button class="aldeia-video-menu-item" data-speed="1.25">1.25x</button>
                                <button class="aldeia-video-menu-item" data-speed="1.5">1.5x</button>
                                <button class="aldeia-video-menu-item" data-speed="2.0">2.0x</button>
                            </div>
                        </div>

                        <!-- Qualidade -->
                        <div class="aldeia-video-menu-wrap">
                            <button class="aldeia-video-menu-btn aldeia-btn-quality">1080p</button>
                            <div class="aldeia-video-menu aldeia-menu-quality">
                                <button class="aldeia-video-menu-item active" data-quality="1080">1080p Full HD</button>
                                <button class="aldeia-video-menu-item" data-quality="720">720p HD</button>
                                <button class="aldeia-video-menu-item" data-quality="480">480p SD</button>
                            </div>
                        </div>

                        <!-- Fullscreen -->
                        <button class="aldeia-video-btn aldeia-btn-fullscreen" title="Tela Cheia (F)">
                            <svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const container = targetEl.querySelector('.aldeia-video-container');
    const video = targetEl.querySelector('.aldeia-video-element');
    const overlayPlay = targetEl.querySelector('.aldeia-video-overlay-play');
    const btnPlay = targetEl.querySelector('.aldeia-btn-play');
    const iconPlay = targetEl.querySelector('.icon-play');
    const iconPause = targetEl.querySelector('.icon-pause');
    const btnMute = targetEl.querySelector('.aldeia-btn-mute');
    const iconVol = targetEl.querySelector('.icon-volume');
    const iconMute = targetEl.querySelector('.icon-mute');
    const timeDisplay = targetEl.querySelector('.aldeia-video-time');
    const timelineWrap = targetEl.querySelector('.aldeia-video-timeline-wrap');
    const progressBar = targetEl.querySelector('.aldeia-video-timeline-progress');
    const bufferedBar = targetEl.querySelector('.aldeia-video-timeline-buffered');

    const btnSpeed = targetEl.querySelector('.aldeia-btn-speed');
    const menuSpeed = targetEl.querySelector('.aldeia-menu-speed');
    const btnQuality = targetEl.querySelector('.aldeia-btn-quality');
    const menuQuality = targetEl.querySelector('.aldeia-menu-quality');
    const btnFullscreen = targetEl.querySelector('.aldeia-btn-fullscreen');

    function formatTime(seconds) {
        if (isNaN(seconds) || seconds === Infinity) return "00:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }

    function togglePlay() {
        if (video.paused) {
            video.play().then(() => {
                container.classList.remove('is-paused');
                overlayPlay.classList.remove('is-paused');
                iconPlay.style.display = 'none';
                iconPause.style.display = 'block';
            }).catch(() => {});
        } else {
            video.pause();
            container.classList.add('is-paused');
            overlayPlay.classList.add('is-paused');
            iconPlay.style.display = 'block';
            iconPause.style.display = 'none';
        }
    }

    // Direct Click
    video.addEventListener('click', togglePlay);
    overlayPlay.addEventListener('click', togglePlay);
    btnPlay.addEventListener('click', togglePlay);

    // Mute
    btnMute.addEventListener('click', () => {
        video.muted = !video.muted;
        if (video.muted) {
            iconVol.style.display = 'none';
            iconMute.style.display = 'block';
        } else {
            iconVol.style.display = 'block';
            iconMute.style.display = 'none';
        }
    });

    // Time Update & Buffered
    video.addEventListener('timeupdate', () => {
        const pct = (video.currentTime / video.duration) * 100;
        progressBar.style.width = `${pct}%`;
        timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;

        if (video.buffered.length > 0) {
            const bufPct = (video.buffered.end(video.buffered.length - 1) / video.duration) * 100;
            bufferedBar.style.width = `${bufPct}%`;
        }
    });

    // Timeline Scrubber Seeking (Zero Lag Click & Drag)
    let isScrubbing = false;
    function seekTimeline(e) {
        const rect = timelineWrap.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        if (video.duration) {
            video.currentTime = pct * video.duration;
            progressBar.style.width = `${pct * 100}%`;
        }
    }

    timelineWrap.addEventListener('mousedown', (e) => {
        isScrubbing = true;
        seekTimeline(e);
    });

    document.addEventListener('mousemove', (e) => {
        if (isScrubbing) seekTimeline(e);
    });

    document.addEventListener('mouseup', () => {
        if (isScrubbing) isScrubbing = false;
    });

    // Speed Selector Menu
    btnSpeed.addEventListener('click', (e) => {
        e.stopPropagation();
        menuQuality.classList.remove('active');
        menuSpeed.classList.toggle('active');
    });

    menuSpeed.querySelectorAll('.aldeia-video-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const speed = parseFloat(item.getAttribute('data-speed'));
            video.playbackRate = speed;
            btnSpeed.textContent = `${speed}x`;
            menuSpeed.querySelectorAll('.aldeia-video-menu-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            menuSpeed.classList.remove('active');
        });
    });

    // Quality Selector Menu
    btnQuality.addEventListener('click', (e) => {
        e.stopPropagation();
        menuSpeed.classList.remove('active');
        menuQuality.classList.toggle('active');
    });

    menuQuality.querySelectorAll('.aldeia-video-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const q = item.getAttribute('data-quality');
            btnQuality.textContent = `${q}p`;
            menuQuality.querySelectorAll('.aldeia-video-menu-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            menuQuality.classList.remove('active');
        });
    });

    // Fullscreen
    btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            if (container.requestFullscreen) container.requestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    });

    // Close menus on click outside
    document.addEventListener('click', () => {
        menuSpeed.classList.remove('active');
        menuQuality.classList.remove('active');
    });

    return { video, container };
};
