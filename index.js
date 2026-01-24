// CELESTIAL FORGE HUD v1.0
const FORGE_Extension = {
    name: 'celestial-forge-hud',
    init: function() {
        console.log('[Forge HUD] Initializing Version 1.1...');
        this.injectHTML();
        this.bindEvents();
        this.makeDraggable(document.getElementById('forge-toggle-btn'));
        setTimeout(() => this.scanLastMessage(), 1500);
    },

    injectHTML: function() {
        $('#forge-hud-container, #forge-toggle-btn').remove();
        const html = `
            <div id="forge-toggle-btn" title="Drag to move, click to toggle">⚒️</div>
            <div id="forge-hud-container" class="hidden">
                <div class="forge-header">
                    <h3 class="forge-title">Celestial Forge</h3>
                </div>
                <div class="cp-dashboard">
                    <div class="cp-box"><div class="cp-label">Available</div><div class="cp-val" id="hud-avail-cp">0</div></div>
                    <div class="cp-box"><div class="cp-label">Total</div><div class="cp-val" id="hud-total-cp">0</div></div>
                </div>
                <div class="meters-area">
                    <div class="meter-row">
                        <div class="meter-label">CORRUPTION</div>
                        <div class="meter-track"><div class="meter-fill" id="hud-bar-corr" style="width:0%; background:#9b59b6;"></div></div>
                        <div id="hud-val-corr" style="width:30px; font-size:10px;">0%</div>
                    </div>
                    <div class="meter-row">
                        <div class="meter-label">SANITY EROSION</div>
                        <div class="meter-track"><div class="meter-fill" id="hud-bar-san" style="width:0%; background:#3498db;"></div></div>
                        <div id="hud-val-san" style="width:30px; font-size:10px;">0%</div>
                    </div>
                </div>
                <div class="perks-list">
                    <div class="perks-title">FORGE RECORD (<span id="hud-perk-count">0</span>)</div>
                    <div id="hud-perks-container"></div>
                </div>
            </div>
        `;
        $('body').append(html);
    },

    bindEvents: function() {
        const context = SillyTavern.getContext();
        context.eventSource.on(context.eventTypes.MESSAGE_RECEIVED, () => this.scanLastMessage());
        context.eventSource.on(context.eventTypes.CHAT_CHANGED, () => this.scanLastMessage());
    },

    makeDraggable: function(el) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        let isDragging = false;
        const threshold = 5; // Pixels to move before it's a "drag" not a "click"

        el.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            isDragging = false;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            
            // Calculate movement
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;

            // If we move more than threshold, it's a drag
            if (Math.abs(pos1) > 1 || Math.abs(pos2) > 1) isDragging = true;

            // Set new position
            el.style.top = (el.offsetTop - pos2) + "px";
            el.style.left = (el.offsetLeft - pos1) + "px";
            el.style.right = 'auto'; // Disable 'right' so 'left' works
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
            
            // If we didn't drag, it's a click! Toggle the HUD.
            if (!isDragging) {
                $('#forge-hud-container').toggleClass('hidden');
            }
        }
    },

    scanLastMessage: function() {
        const context = SillyTavern.getContext();
        const chat = context.chat;
        if (!chat || chat.length === 0) return;

        for (let i = chat.length - 1; i >= 0; i--) {
            const msg = chat[i];
            if (!msg.mes) continue;
            const match = msg.mes.match(/```forge\s*([\s\S]*?)```/);
            if (match && match[1]) {
                try {
                    const data = JSON.parse(match[1]);
                    const stats = data.characters?.[0]?.stats || data.stats;
                    if (stats) { this.updateDisplay(stats); break; }
                } catch (e) {}
            }
        }
    },

    updateDisplay: function(stats) {
        $('#hud-avail-cp').text(stats.available_cp || 0);
        $('#hud-total-cp').text(stats.total_cp || 0);
        $('#hud-bar-corr').css('width', (stats.corruption || 0) + '%');
        $('#hud-val-corr').text((stats.corruption || 0) + '%');
        $('#hud-bar-san').css('width', (stats.sanity || 0) + '%');
        $('#hud-val-san').text((stats.sanity || 0) + '%');

        const perks = stats.perks || [];
        $('#hud-perk-count').text(perks.length);
        const container = $('#hud-perks-container').empty();

        perks.forEach(p => {
            let flags = (p.flags || []).map(f => `<span class="flag">${f}</span>`).join('');
            let scale = '';
            if (p.scaling) {
                scale = `<div class="scaling-box">
                    <div class="scale-info"><span>LVL ${p.scaling.level}</span><span>${p.scaling.xp} XP</span></div>
                    <div class="scale-track"><div class="scale-fill" style="width:${p.scaling.xp_percent || 0}%"></div></div>
                </div>`;
            }
            container.append(`
                <div class="perk-card ${p.active ? 'active' : ''}">
                    <div class="perk-head"><span>${p.name}</span><span class="perk-cost">${p.cost} CP</span></div>
                    <div class="perk-flags">${flags}<span class="flag ${p.active ? 'active-flag' : ''}">${p.active ? 'ACTIVE' : 'OFF'}</span></div>
                    ${scale}
                    <div class="perk-desc">${p.description || ''}</div>
                </div>
            `);
        });
    }
};

jQuery(() => FORGE_Extension.init());
    FORGE_Extension.init();
});
