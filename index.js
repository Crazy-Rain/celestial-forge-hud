// CELESTIAL FORGE HUD v1.1
const FORGE_Extension = {
    name: 'celestial-forge-hud',
    state: {
        available_cp: 0,
        total_cp: 0,
        corruption: 0,
        sanity: 0,
        perks: []
    },

    init: function() {
        console.log('[Forge HUD] Initializing...');
        this.injectHTML();
        this.bindEvents();
        setTimeout(() => this.scanLastMessage(), 2000);
    },

    injectHTML: function() {
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

                <div class="perks-list">
                    <div class="perks-title">Acquired Perks (<span id="hud-perk-count">0</span>)</div>
                    <div id="hud-perks-container"></div>
                </div>
            </div>
        `;
        $('body').append(html);
    },

    bindEvents: function() {
        // --- DRAGGING LOGIC ---
        const btn = document.getElementById('forge-toggle-btn');
        let isDragging = false;
        let hasMoved = false; // To distinguish between click and drag
        let startX, startY, initialLeft, initialTop;

        const onMove = (e) => {
            if (!isDragging) return;
            hasMoved = true;
            
            // Handle both mouse and touch events
            const clientX = e.clientX || e.touches[0].clientX;
            const clientY = e.clientY || e.touches[0].clientY;

            const dx = clientX - startX;
            const dy = clientY - startY;

            // Constrain within window
            let newTop = initialTop + dy;
            let newLeft = initialLeft + dx;

            // Simple boundary checks
            const maxTop = window.innerHeight - btn.offsetHeight;
            const maxLeft = window.innerWidth - btn.offsetWidth;
            
            newTop = Math.max(0, Math.min(newTop, maxTop));
            newLeft = Math.max(0, Math.min(newLeft, maxLeft));

            btn.style.top = `${newTop}px`;
            btn.style.left = `${newLeft}px`;
            btn.style.right = 'auto'; // Disable 'right' so 'left' takes over
        };

        const onUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
        };

        const onDown = (e) => {
            isDragging = true;
            hasMoved = false;
            
            startX = e.clientX || e.touches[0].clientX;
            startY = e.clientY || e.touches[0].clientY;

            const rect = btn.getBoundingClientRect();
            initialTop = rect.top;
            initialLeft = rect.left;

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onUp);
        };

        btn.addEventListener('mousedown', onDown);
        btn.addEventListener('touchstart', onDown, { passive: false });

        // --- CLICK LOGIC (Only if not dragged) ---
        btn.addEventListener('click', (e) => {
            if (hasMoved) return; // Prevent toggle if we just dragged it
            $('#forge-hud-container').toggleClass('hidden');
        });

        // --- SillyTavern Event Listeners ---
        const context = SillyTavern.getContext();
        context.eventSource.on(context.eventTypes.MESSAGE_RECEIVED, () => this.scanLastMessage());
        context.eventSource.on(context.eventTypes.CHAT_CHANGED, () => this.scanLastMessage());
    },

    scanLastMessage: function() {
        const context = SillyTavern.getContext();
        const chat = context.chat;
        if (!chat || chat.length === 0) return;

        let foundBlock = false;
        for (let i = chat.length - 1; i >= 0; i--) {
            const msg = chat[i];
            if (!msg.mes) continue;

            const blockMatch = msg.mes.match(/```forge\s*([\s\S]*?)```/);
            if (blockMatch && blockMatch[1]) {
                try {
                    const data = JSON.parse(blockMatch[1]);
                    let stats = null;
                    if (data.characters && data.characters[0] && data.characters[0].stats) {
                        stats = data.characters[0].stats;
                    } else if (data.stats) {
                        stats = data.stats;
                    }
                    
                    if (stats) {
                        this.updateDisplay(stats);
                        foundBlock = true;
                        break;
                    }
                } catch (e) {
                    console.error('[Forge HUD] JSON Parse Error:', e);
                }
            }
        }
        if (!foundBlock) console.log('[Forge HUD] No valid forge block found.');
    },

    updateDisplay: function(stats) {
        $('#hud-avail-cp').text(stats.available_cp || 0);
        $('#hud-total-cp').text(stats.total_cp || 0);
        
        const corr = stats.corruption || 0;
        const san = stats.sanity || 0;
        $('#hud-bar-corr').css('width', corr + '%');
        $('#hud-val-corr').text(corr + '%');
        $('#hud-bar-san').css('width', san + '%');
        $('#hud-val-san').text(san + '%');

        const perks = stats.perks || [];
        $('#hud-perk-count').text(stats.perk_count || perks.length);
        
        const container = $('#hud-perks-container');
        container.empty();

        perks.forEach(perk => {
            const activeClass = perk.active ? 'active' : '';
            const statusText = perk.active ? 'ACTIVE' : 'OFFLINE';
            
            let flagsHtml = '';
            if (perk.flags && Array.isArray(perk.flags)) {
                perk.flags.forEach(f => flagsHtml += `<span class="flag">${f}</span>`);
            }
            flagsHtml += `<span class="flag ${activeClass}">${statusText}</span>`;

            let scalingHtml = '';
            if (perk.scaling) {
                const percent = perk.scaling.xp_percent || 0;
                scalingHtml = `
                    <div class="scaling-box">
                        <div class="scale-info">
                            <span>Lv. ${perk.scaling.level}</span>
                            <span>${perk.scaling.xp} XP</span>
                        </div>
                        <div class="scale-track">
                            <div class="scale-fill" style="width: ${percent}%"></div>
                        </div>
                    </div>
                `;
            }

            const card = `
                <div class="perk-card ${activeClass}">
                    <div class="perk-head">
                        <span>${perk.name}</span>
                        <span class="perk-cost">${perk.cost} CP</span>
                    </div>
                    <div class="perk-flags">${flagsHtml}</div>
                    ${scalingHtml}
                    <div class="perk-desc">${perk.description}</div>
                </div>
            `;
            container.append(card);
        });
    }
};

jQuery(document).ready(function() {
    FORGE_Extension.init();
});
