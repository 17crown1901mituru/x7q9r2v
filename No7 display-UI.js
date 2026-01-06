/******************************************************
 * Part 6：UI（HTML描写 / 折りたたみ / ドラッグ対応）
 ******************************************************/
(function() {
    'use strict';

    // 親ページのみ
    if (window !== window.parent) return;

    const state = window.state;
    state.uiCollapsed = false; // ★ 収納状態

    /******************************************************
     * UI生成
     ******************************************************/
    function createUI() {
        if (document.getElementById('tmx-ui-root')) return;

        const root = document.createElement('div');
        root.id = 'tmx-ui-root';
        root.style.cssText =
            'position:fixed;top:10px;right:2px;z-index:2147483647;' +
            'width:54px;display:flex;flex-direction:column;gap:4px;';

        const style = document.createElement('style');
        style.textContent = `
            #tmx-ui-root .btn {
                width: 54px; height: 48px; background: #000; border: 1px solid #666;
                font-size: 10px; text-align: center; cursor: pointer; font-weight: bold;
                color: #fff; display: flex; flex-direction: column; align-items: center;
                justify-content: center; line-height: 1.2; border-radius: 3px;
            }
            #tmx-ui-root .disp {
                width: 54px; height: 32px; background: #111; border: 1px solid #444;
                font-size: 10px; text-align: center; color: #0f0; display: flex;
                align-items: center; justify-content: center; border-radius: 3px;
                font-weight: bold;
            }
            #tmx-ui-root .btn:active { background: #333; }
        `;

        document.body.appendChild(style);
        document.body.appendChild(root);

        // UI ボタン
        const ui = {
            r: document.createElement('div'),
            m: document.createElement('div'),
            d: document.createElement('div'),
            i: document.createElement('div'),
            c: document.createElement('div'),
            l: document.createElement('div') // LOGボタン
        };

        Object.keys(ui).forEach(k => {
            ui[k].className = (k === 'c') ? 'disp' : 'btn';
            root.appendChild(ui[k]);
        });

        /******************************************************
         * UI更新
         ******************************************************/
        state.updateUI = () => {
            // 収納時は LOG ボタン以外を隠す
            if (state.uiCollapsed) {
                ui.r.style.display = 'none';
                ui.m.style.display = 'none';
                ui.d.style.display = 'none';
                ui.i.style.display = 'none';
                ui.c.style.display = 'none';

                ui.l.innerHTML = 'LOG<br>▼';
                ui.l.style.background = '#003300';

                // ★ ドラッグ可能にする
                enableDrag(root);
            } else {
                // 展開時は全部表示
                ui.r.style.display = '';
                ui.m.style.display = '';
                ui.d.style.display = '';
                ui.i.style.display = '';
                ui.c.style.display = '';

                ui.l.innerHTML = 'LOG<br>▲';
                ui.l.style.background = '#004400';

                // ★ 展開時は右上固定・ドラッグ不可
                disableDrag(root);
                root.style.top = '10px';
                root.style.right = '2px';
                root.style.left = '';
            }

            // 通常の UI 更新
            ui.r.innerHTML = `Repair<br>${state.repairEnabled ? 'ON' : 'OFF'}`;
            ui.r.style.color = state.repairEnabled ? '#5bc0de' : '#666';

            ui.m.innerHTML = `Mode<br>${state.equipMode}`;
            ui.m.style.color = { 'A': '#ff0', 'B': '#f00', 'N': '#fff' }[state.equipMode];

            ui.d.innerHTML = `Delay<br>${state.delayMs}`;
            ui.d.style.color = state.delayMs > 0 ? '#ff9900' : '#0f0';

            ui.i.innerHTML = state.targetHpName;

            const cur = (state.availableItems || []).find(x => x.name === state.targetHpName);
            ui.c.innerHTML = cur ? cur.stock : '0';
        };

        /******************************************************
         * ボタン動作
         ******************************************************/
        ui.r.onclick = () => {
            state.repairEnabled = !state.repairEnabled;
            state.saveSettings();
            state.updateUI();
            if (window.sendConfigToIframe) window.sendConfigToIframe();
        };

        ui.m.onclick = () => {
            state.equipMode = { 'N': 'A', 'A': 'B', 'B': 'N' }[state.equipMode];
            state.saveSettings();
            state.updateUI();
            if (window.sendConfigToIframe) window.sendConfigToIframe();
        };

        ui.d.onclick = () => {
            state.delayMs = (state.delayMs + 500) % 2500;
            state.saveSettings();
            state.updateUI();
            if (window.sendConfigToIframe) window.sendConfigToIframe();
        };

        ui.i.onclick = () => {
            const names = ['FREE'].concat((state.availableItems || []).map(x => x.name));
            state.targetHpName = names[(names.indexOf(state.targetHpName) + 1) % names.length] || 'FREE';
            state.saveSettings();
            state.updateUI();
            if (window.sendConfigToIframe) window.sendConfigToIframe();
        };

        // ★ LOGボタン → 収納/展開
        ui.l.onclick = () => {
            state.uiCollapsed = !state.uiCollapsed;
            state.updateUI();
        };

        state.updateUI();
    }

    /******************************************************
     * ドラッグ機能（収納時のみ有効）
     ******************************************************/
    function enableDrag(root) {
        let offsetX = 0, offsetY = 0, dragging = false;

        root.onmousedown = (e) => {
            dragging = true;
            offsetX = e.clientX - root.getBoundingClientRect().left;
            offsetY = e.clientY - root.getBoundingClientRect().top;
            root.style.right = ''; // 固定解除
        };

        document.onmousemove = (e) => {
            if (!dragging) return;
            root.style.left = (e.clientX - offsetX) + 'px';
            root.style.top  = (e.clientY - offsetY) + 'px';
        };

        document.onmouseup = () => dragging = false;
    }

    function disableDrag(root) {
        root.onmousedown = null;
        document.onmousemove = null;
        document.onmouseup = null;
    }

    /******************************************************
     * UI生成呼び出し
     ******************************************************/
    window.addEventListener('DOMContentLoaded', createUI);

})();    };

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
