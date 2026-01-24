// CELESTIAL FORGE HUD v1.0
const FORGE_Extension = {
    name: 'celestial-forge-hud',
    // Default state if nothing is found
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
        // Check initial load
        setTimeout(() => this.scanLastMessage(), 2000);
    },

    injectHTML: function() {
        // Remove existing if any (for reloading)
        $('#forge-hud-container').remove();
        $('#forge-toggle-btn').remove();

        // The Main Sidebar
        const html = `
            <div id="forge-toggle-btn" title="Toggle Forge HUD">⚒️</div>
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
                    <div id="hud-perks-container">
                        </div>
                </div>
            </div>
        `;
        $('body').append(html);
    },

    bindEvents: function() {
        // Toggle Button Logic
        $(document).on('click', '#forge-toggle-btn', function() {
            $('#forge-hud-container').toggleClass('hidden');
        });

        // SillyTavern Event Listeners
        const context = SillyTavern.getContext();
        
        // When a new message arrives
        context.eventSource.on(context.eventTypes.MESSAGE_RECEIVED, () => {
            this.scanLastMessage();
        });
        
        // When chat is changed/loaded
        context.eventSource.on(context.eventTypes.CHAT_CHANGED, () => {
            this.scanLastMessage();
        });
    },

    scanLastMessage: function() {
        const context = SillyTavern.getContext();
        const chat = context.chat;
        
        if (!chat || chat.length === 0) return;

        // Look backwards from the last message to find a forge block
        // This ensures if the last message was a system note, we still find the data
        let foundBlock = false;
        for (let i = chat.length - 1; i >= 0; i--) {
            const msg = chat[i];
            if (!msg.mes) continue;

            // Regex to find the ```forge ... ``` block
            const blockMatch = msg.mes.match(/```forge\s*([\s\S]*?)```/);
            
            if (blockMatch && blockMatch[1]) {
                try {
                    const data = JSON.parse(blockMatch[1]);
                    // We assume standard structure: { characters: [ { stats: ... } ] }
                    // OR simple structure: { stats: ... }
                    let stats = null;
                    
                    if (data.characters && data.characters[0] && data.characters[0].stats) {
                        stats = data.characters[0].stats;
                    } else if (data.stats) {
                        stats = data.stats;
                    }

                    if (stats) {
                        this.updateDisplay(stats);
                        foundBlock = true;
                        break; // Stop looking once we find the latest block
                    }
                } catch (e) {
                    console.error('[Forge HUD] JSON Parse Error:', e);
                }
            }
        }
        
        if (!foundBlock) console.log('[Forge HUD] No valid forge block found in recent history.');
    },

    updateDisplay: function(stats) {
        // Update Numbers
        $('#hud-avail-cp').text(stats.available_cp || 0);
        $('#hud-total-cp').text(stats.total_cp || 0);
        
        // Update Meters
        const corr = stats.corruption || 0;
        const san = stats.sanity || 0;
        $('#hud-bar-corr').css('width', corr + '%');
        $('#hud-val-corr').text(corr + '%');
        $('#hud-bar-san').css('width', san + '%');
        $('#hud-val-san').text(san + '%');

        // Update Perks List
        const perks = stats.perks || [];
        $('#hud-perk-count').text(stats.perk_count || perks.length);
        
        const container = $('#hud-perks-container');
        container.empty();

        perks.forEach(perk => {
            const activeClass = perk.active ? 'active' : '';
            const statusText = perk.active ? 'ACTIVE' : 'OFFLINE';
            
            // Build Flags HTML
            let flagsHtml = '';
            if (perk.flags && Array.isArray(perk.flags)) {
                perk.flags.forEach(f => flagsHtml += `<span class="flag">${f}</span>`);
            }
            flagsHtml += `<span class="flag ${activeClass}">${statusText}</span>`;

            // Build Scaling HTML
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

// Start the extension
jQuery(document).ready(function() {
    FORGE_Extension.init();
});
