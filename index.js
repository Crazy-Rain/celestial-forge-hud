// CELESTIAL FORGE HUD v1.2
// Changelog:
//   - FIX: pointer-events: none on hidden panel (was blocking ST right-side UI clicks)
//   - FIX: now listens to 'celestial-forge-update' from Tracker for live sync
//   - FIX: scanLastMessage caches last found index to avoid full-history scan every time
//   - ADD: pending perk display
//   - ADD: sync status indicator (live vs forge-block-sourced)
//   - ADD: toggle button shifts left when panel is open

const FORGE_Extension = {
    name: 'celestial-forge-hud',
    lastScannedIndex: -1,   // cache: avoid re-scanning old messages
    usingLiveSync: false,   // true when receiving live events from Tracker

    state: {
        available_cp: 0,
        total_cp: 0,
        corruption: 0,
        sanity: 0,
        perks: [],
        perk_count: 0,
        pending_perk: '',
        pending_cp: 0,
        pending_remaining: 0
    },

    init: function () {
        console.log('[Forge HUD] Initializing v1.2...');
        this.injectHTML();
        this.bindEvents();
        setTimeout(() => this.scanLastMessage(), 2000);
    },

    injectHTML: function () {
        $('#forge-hud-container').remove();
        $('#forge-toggle-btn').remove();

        const html = `
            <div id="forge-toggle-btn" title="Drag to move, Click to toggle">⚒️</div>
            <div id="forge-hud-container" class="hidden">
                <div class="forge-header">
                    <h3 class="forge-title">Celestial Forge</h3>
                    <div style="font-size:10px; color:#888;">System Online</div>
                </div>

                <div class="cp-dashboard">
                    <div class="cp-box">
                        <div class="cp-label">Available CP</div>
                        <div class="cp-val" id="hud-avail-cp">0</div>
                    </div>
                    <div class="cp-box">
                        <div class="cp-label">Total CP</div>
                        <div class="cp-val" id="hud-total-cp">0</div>
                    </div>
                </div>

                <div class="meters-area">
                    <div class="meter-row">
                        <div class="meter-label" style="color:#9b59b6">CORRUPTION</div>
                        <div class="meter-track">
                            <div class="meter-fill" id="hud-bar-corr" style="width: 0%; background: #9b59b6;"></div>
                        </div>
                        <div id="hud-val-corr">0%</div>
                    </div>
                    <div class="meter-row">
                        <div class="meter-label" style="color:#3498db">SANITY</div>
                        <div class="meter-track">
                            <div class="meter-fill" id="hud-bar-san" style="width: 0%; background: #3498db;"></div>
                        </div>
                        <div id="hud-val-san">0%</div>
                    </div>
                </div>

                <div id="hud-pending-area"></div>

                <div class="perks-list">
                    <div class="perks-title">Acquired Perks (<span id="hud-perk-count">0</span>)</div>
                    <div id="hud-perks-container"><small style="color:#666;">No perks yet.</small></div>
                </div>

                <div class="forge-sync-status" id="hud-sync-status">waiting for data…</div>
            </div>
        `;
        $('body').append(html);
    },

    bindEvents: function () {
        // ── Drag logic ──────────────────────────────────────────────
        const btn = document.getElementById('forge-toggle-btn');
        let isDragging = false;
        let hasMoved = false;
        let startX, startY, initialLeft, initialTop;

        const onMove = (e) => {
            if (!isDragging) return;
            hasMoved = true;
            const clientX = e.clientX ?? e.touches[0].clientX;
            const clientY = e.clientY ?? e.touches[0].clientY;
            let newTop  = Math.max(0, Math.min(initialTop  + (clientY - startY), window.innerHeight - btn.offsetHeight));
            let newLeft = Math.max(0, Math.min(initialLeft + (clientX - startX), window.innerWidth  - btn.offsetWidth));
            btn.style.top  = `${newTop}px`;
            btn.style.left = `${newLeft}px`;
            btn.style.right = 'auto';
        };

        const onUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup',   onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend',  onUp);
        };

        btn.addEventListener('mousedown', (e) => {
            isDragging = true; hasMoved = false;
            startX = e.clientX; startY = e.clientY;
            const r = btn.getBoundingClientRect();
            initialTop = r.top; initialLeft = r.left;
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup',   onUp);
        });

        btn.addEventListener('touchstart', (e) => {
            isDragging = true; hasMoved = false;
            startX = e.touches[0].clientX; startY = e.touches[0].clientY;
            const r = btn.getBoundingClientRect();
            initialTop = r.top; initialLeft = r.left;
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend',  onUp);
        }, { passive: false });

        // ── Click: toggle panel ──────────────────────────────────────
        btn.addEventListener('click', () => {
            if (hasMoved) return;
            const container = $('#forge-hud-container');
            container.toggleClass('hidden');
            // shift button so it doesn't overlap panel header
            btn.classList.toggle('panel-open', !container.hasClass('hidden'));
        });

        // ── SillyTavern events ──────────────────────────────────────
        const context = SillyTavern.getContext();

        context.eventSource.on(context.eventTypes.MESSAGE_RECEIVED, () => {
            // If we have live sync from Tracker, skip the scan
            if (!this.usingLiveSync) this.scanLastMessage();
        });

        context.eventSource.on(context.eventTypes.CHAT_CHANGED, () => {
            // Chat changed — reset cache and always re-scan
            this.lastScannedIndex = -1;
            this.usingLiveSync = false;
            this.scanLastMessage();
        });

        // ── Live sync from Tracker extension ────────────────────────
        // Tracker fires 'celestial-forge-update' on every state change.
        // Prefer this over forge-block scanning when available.
        window.addEventListener('celestial-forge-update', (e) => {
            if (!e.detail?.characters?.[0]?.stats) return;
            this.usingLiveSync = true;
            const stats = e.detail.characters[0].stats;
            this.updateDisplay(stats);
            this.setSyncStatus('live', '● live sync');
        });

        // Also check if Tracker already fired before we loaded
        if (window.celestialForgeState?.characters?.[0]?.stats) {
            this.usingLiveSync = true;
            this.updateDisplay(window.celestialForgeState.characters[0].stats);
            this.setSyncStatus('live', '● live sync');
        }
    },

    setSyncStatus: function (cls, text) {
        const el = document.getElementById('hud-sync-status');
        if (!el) return;
        el.className = `forge-sync-status ${cls}`;
        el.textContent = text;
    },

    // Scans backwards from the end, but starts at lastScannedIndex if valid
    scanLastMessage: function () {
        const context = SillyTavern.getContext();
        const chat = context.chat;
        if (!chat || chat.length === 0) return;

        // Start scanning from the newest message we haven't seen
        const startIdx = chat.length - 1;

        for (let i = startIdx; i >= 0; i--) {
            // Stop if we've already processed this index
            if (i < this.lastScannedIndex) break;

            const msg = chat[i];
            if (!msg.mes) continue;

            const blockMatch = msg.mes.match(/```forge\s*([\s\S]*?)```/);
            if (blockMatch?.[1]) {
                try {
                    const data = JSON.parse(blockMatch[1]);
                    let stats = null;

                    if (data.characters?.[0]?.stats) {
                        stats = data.characters[0].stats;
                    } else if (data.stats) {
                        stats = data.stats;
                    }

                    if (stats) {
                        this.lastScannedIndex = i;
                        this.updateDisplay(stats);
                        this.setSyncStatus('stale', `⬡ forge block · msg ${i}`);
                        return;
                    }
                } catch (e) {
                    console.error('[Forge HUD] JSON parse error in message', i, e);
                }
            }
        }

        // Nothing found — update status but don't clear existing data
        if (this.lastScannedIndex === -1) {
            this.setSyncStatus('', 'no forge block found');
        }
    },

    updateDisplay: function (stats) {
        $('#hud-avail-cp').text(stats.available_cp ?? 0);
        $('#hud-total-cp').text(stats.total_cp ?? 0);

        const corr = stats.corruption ?? 0;
        const san  = stats.sanity ?? 0;
        $('#hud-bar-corr').css('width', corr + '%');
        $('#hud-val-corr').text(corr + '%');
        $('#hud-bar-san').css('width', san + '%');
        $('#hud-val-san').text(san + '%');

        const perks = stats.perks ?? [];
        $('#hud-perk-count').text(stats.perk_count ?? perks.length);

        // Pending perk
        const pendingArea = $('#hud-pending-area');
        if (stats.pending_perk) {
            pendingArea.html(`
                <div class="forge-pending">
                    <div class="forge-pending-label">⏳ Pending Perk</div>
                    <div class="forge-pending-name">${stats.pending_perk}</div>
                    <div class="forge-pending-need">
                        ${stats.pending_cp} CP needed · ${stats.pending_remaining} more to go
                    </div>
                </div>
            `);
        } else {
            pendingArea.empty();
        }

        // Perk cards
        const container = $('#hud-perks-container');
        container.empty();

        if (perks.length === 0) {
            container.html('<small style="color:#666;">No perks yet.</small>');
            return;
        }

        perks.forEach(perk => {
            const activeClass  = perk.active ? 'active' : '';
            const statusText   = perk.active ? 'ACTIVE' : 'OFFLINE';

            let flagsHtml = '';
            if (Array.isArray(perk.flags)) {
                perk.flags.forEach(f => flagsHtml += `<span class="flag">${f}</span>`);
            }
            flagsHtml += `<span class="flag ${activeClass}">${statusText}</span>`;

            let scalingHtml = '';
            if (perk.scaling) {
                const pct      = perk.scaling.xp_percent ?? 0;
                const maxLabel = perk.scaling.uncapped ? '∞' : perk.scaling.maxLevel;
                scalingHtml = `
                    <div class="scaling-box">
                        <div class="scale-info">
                            <span>Lv.${perk.scaling.level} / ${maxLabel}</span>
                            <span>${perk.scaling.xp} XP</span>
                        </div>
                        <div class="scale-track">
                            <div class="scale-fill" style="width: ${pct}%"></div>
                        </div>
                    </div>`;
            }

            container.append(`
                <div class="perk-card ${activeClass}">
                    <div class="perk-head">
                        <span>${perk.name}</span>
                        <span class="perk-cost">${perk.cost} CP</span>
                    </div>
                    <div class="perk-flags">${flagsHtml}</div>
                    ${scalingHtml}
                    <div class="perk-desc">${perk.description ?? ''}</div>
                </div>
            `);
        });
    }
};

jQuery(document).ready(function () {
    FORGE_Extension.init();
});
