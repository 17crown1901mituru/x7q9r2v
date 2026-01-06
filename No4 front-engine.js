/******************************************************
 * Part 4：表エンジン（マイページ常駐型 / iframe 起動）
 ******************************************************/
(function() {
    'use strict';

    // 親ページのみ
    if (window !== window.parent) return;

    const state = window.state;

    /******************************************************
     * iframe に設定を送信
     ******************************************************/
    window.sendConfigToIframe = function() {
        if (!state.warIframe) return;

        state.warIframe.contentWindow.postMessage({
            type: 'WAR_CONFIG',
            payload: {
                repairEnabled: state.repairEnabled,
                equipMode:     state.equipMode,
                targetHpName:  state.targetHpName,
                delayMs:       state.delayMs
            }
        }, '*');
    };

    /******************************************************
     * HP残数リアルタイム反映
     ******************************************************/
    window.addEventListener('message', (ev) => {
        if (!ev.data || ev.data.type !== 'HP_REMAIN') return;

        const { name, stock } = ev.data.payload || {};
        if (!name) return;

        const items = state.availableItems || [];
        const idx = items.findIndex(x => x.name === name);

        if (idx >= 0) {
            items[idx].stock = stock;
        } else {
            items.push({ name, stock });
        }

        state.availableItems = items;

        if (state.updateUI) state.updateUI();
    });

    /******************************************************
     * 抗争終了通知
     ******************************************************/
    window.addEventListener('message', (ev) => {
        if (ev.data?.type === 'WAR_FINISHED') {
            state.phase = 'IDLE';
            if (state.updateUI) state.updateUI();
        }
    });

    /******************************************************
     * ログ受信（Front / Action / Traffic）
     ******************************************************/
    window.addEventListener('message', (ev) => {
        if (!ev.data || !ev.data.type || !ev.data.text) return;

        const t = ev.data.type;
        const line = ev.data.text;

        if (t === 'LOG_FRONT') {
            state.logs.front.push(line);
        }
        if (t === 'LOG_ACTION') {
            state.logs.action.push(line);
        }
        if (t === 'LOG_TRAFFIC') {
            state.logs.traffic.push(line);
        }

        state.saveLogs();

        // 別タブが開いていれば転送
        if (state.logWindow && !state.logWindow.closed) {
            state.logWindow.postMessage(ev.data, '*');
        }
    });

    /******************************************************
     * マイページで iframe を起動
     ******************************************************/
    function bootWarIframeFromMy() {
        // ★ マイページ以外では起動しない
        if (!location.pathname.startsWith('/my')) return;

        // すでに iframe があれば再生成しない
        if (state.warIframe && !state.warIframe.closed) return;

        state.resetLogs();
        state.isWarActive = true;
        state.phase = 'IDLE';

        // ★ 裏で抗争メンバーリストを開く
        const iframe = document.createElement('iframe');
        iframe.src = '/war/member-list';
        iframe.style.cssText =
            'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';

        document.body.appendChild(iframe);

        state.warIframe = iframe;

        iframe.onload = () => {
            window.sendConfigToIframe();
        };
    }

    window.addEventListener('DOMContentLoaded', bootWarIframeFromMy);

})();
