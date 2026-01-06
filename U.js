/******************************************************
 * UI（右上パネル）
 ******************************************************/
(function() {
    'use strict';
    if (window.self !== window.top) return; // iframeでは動かさない

    // ★ DOMContentLoaded を待つ（旧版と同じ挙動）
    window.addEventListener('DOMContentLoaded', () => {

        const state = window.state;

        if (document.getElementById('tmx-shadow-container')) return;

        const container = document.createElement('div');
        container.id = 'tmx-shadow-container';
        const shadow = container.attachShadow({mode: 'open'});
        document.documentElement.appendChild(container);

        const root = document.createElement('div');
        root.style.cssText =
            'position:fixed;top:10px;right:2px;z-index:2147483647;width:54px;display:flex;flex-direction:column;gap:4px;';

        const style = document.createElement('style');
    style.textContent = `
        .btn { width:54px;height:48px;background:#000;border:1px solid #666;
               font-size:10px;text-align:center;color:#fff;cursor:pointer;
               display:flex;flex-direction:column;justify-content:center;
               border-radius:3px; }
        .disp { width:54px;height:32px;background:#111;border:1px solid #444;
                font-size:10px;color:#0f0;display:flex;align-items:center;
                justify-content:center;border-radius:3px;font-weight:bold; }
        .btn:active { background:#333; }
    `;
    shadow.appendChild(style);
    shadow.appendChild(root);

    const ui = {
        r: document.createElement('div'),
        m: document.createElement('div'),
        d: document.createElement('div'),
        i: document.createElement('div'),
        c: document.createElement('div'),
        l: document.createElement('div')
    };

    Object.keys(ui).forEach(k => {
        ui[k].className = (k === 'c') ? 'disp' : 'btn';
        root.appendChild(ui[k]);
    });

    state.updateUI = () => {
        ui.r.innerHTML = `Repair<br>${state.repairEnabled ? 'ON' : 'OFF'}`;
        ui.r.style.color = state.repairEnabled ? '#5bc0de' : '#666';

        ui.m.innerHTML = `Mode<br>${state.equipMode}`;
        ui.m.style.color = { 'A': '#ff0', 'B': '#f00', 'N': '#fff' }[state.equipMode];

        ui.d.innerHTML = `Delay<br>${state.delayMs}`;
        ui.d.style.color = state.delayMs > 0 ? '#ff9900' : '#0f0';

        const truncatedName = state.targetHpName.substring(0, 10);
        ui.i.innerHTML = `<div style="font-size:8px;">${truncatedName}</div>`;

        const cur = state.availableItems?.find(x => x.name === state.targetHpName);
        ui.c.innerHTML = `<span style="font-size:13px;">${cur ? cur.stock : '0'}</span>`;

        ui.l.innerHTML = 'LOG<br>VIEW';
        ui.l.style.background = '#004400';
    };

    ui.r.onclick = () => {
        state.repairEnabled = !state.repairEnabled;
        state.saveSettings();
        state.updateUI();
        window.sendConfigToIframe();
    };

    ui.m.onclick = () => {
        state.equipMode = { 'N': 'A', 'A': 'B', 'B': 'N' }[state.equipMode];
        state.saveSettings();
        state.updateUI();
        window.sendConfigToIframe();
    };

    ui.d.onclick = () => {
        state.delayMs = (state.delayMs + 500) % 2500;
        state.saveSettings();
        state.updateUI();
        window.sendConfigToIframe();
    };

    ui.i.onclick = () => {
        const names = ['FREE'].concat((state.availableItems || []).map(x => x.name));
        state.targetHpName = names[(names.indexOf(state.targetHpName) + 1) % names.length] || 'FREE';
        state.saveSettings();
        state.updateUI();
        window.sendConfigToIframe();
    };

    ui.l.onclick = () => window.openLogViewer();

    setInterval(() => state.updateUI(), 500);
    state.updateUI();
})();