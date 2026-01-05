// ==UserScript==
// @name         Tantora Ultra Engine V15 (iframe split)
// @namespace    https://viayoo.com/ekt6gu
// @version      15.11.7-iframe
// @match        https://tantora.jp/*
// @author       光琉✞みつる
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const isIframe = window !== window.parent;

    /******************************************************
     * 共通 state 初期化（UIもiframeも同じ構造を参照）
     ******************************************************/
    const STORAGE_KEY_SETTINGS = 'tmx_v15_settings';
    const STORAGE_KEY_LOGS     = 'tmx_v15_logs';

    const savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || '{}');
    const savedLogs     = JSON.parse(localStorage.getItem(STORAGE_KEY_LOGS) || '{}');

    if (!window.state) {
        window.state = {
            flowFlag: 0,
            repairEnabled: savedSettings.repairEnabled || false,
            equipMode:     savedSettings.equipMode     || 'N',
            targetHpName:  savedSettings.hpName        || 'FREE',
            delayMs:       savedSettings.delayMs !== undefined ? savedSettings.delayMs : 0,

            phase:          'IDLE',
            availableItems: [],
            enemyTeamId:    null,
            teamId:         null,
            startTime:      null,
            isTimerRunning: false,
            isWarActive:    false,
            loggingActive:  false,

            logs: {
                action: Array.isArray(savedLogs.action)  ? savedLogs.action  : [],
                traffic: Array.isArray(savedLogs.traffic) ? savedLogs.traffic : []
            },

            saveSettings() {
                localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify({
                    repairEnabled: this.repairEnabled,
                    equipMode:     this.equipMode,
                    hpName:        this.targetHpName,
                    delayMs:       this.delayMs
                }));
            },

            saveLogs() {
                localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify({
                    action: this.logs.action,
                    traffic: this.logs.traffic,
                    teamId: this.teamId,
                    startTime: this.startTime
                }));
            },

            resetLogs() {
                this.logs.action = [];
                this.logs.traffic = [];
                this.saveLogs();
            }
        };
    }

    window.originalFetch = window.originalFetch || window.fetch;
})();

/******************************************************
 * ここから：表タブ専用（UI・司令塔）
 ******************************************************/
(function() {
    'use strict';
    if (window !== window.parent) return; // iframeでは動かさない

    const state = window.state;

    // --- UI構築（あなたの元コードそのまま） ---
    if (document.getElementById('tmx-shadow-container')) return;

    const container = document.createElement('div');
    container.id = 'tmx-shadow-container';
    const shadow = container.attachShadow({mode: 'open'});
    document.documentElement.appendChild(container);

    const root = document.createElement('div');
    root.style.cssText = 'position:fixed!important;top:10px!important;right:2px!important;z-index:2147483647!important;width:54px!important;display:flex!important;flex-direction:column!important;gap:4px!important;';

    const style = document.createElement('style');
    style.textContent = `
        .btn { width: 54px; height: 48px; background: #000; border: 1px solid #666; font-size: 10px; text-align: center; cursor: pointer; font-weight: bold; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.2; border-radius: 3px; overflow: hidden; }
        .disp { width: 54px; height: 32px; background: #111; border: 1px solid #444; font-size: 10px; text-align: center; color: #0f0; display: flex; align-items: center; justify-content: center; border-radius: 3px; font-weight: bold; }
        .btn:active { background: #333; }
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

        if (state.phase === 'IDLE') {
            ui.l.innerHTML = 'LOG<br>SAVE';
            ui.l.style.background = '#004400';
        } else {
            ui.l.innerHTML = 'RECV<br>NOW';
            ui.l.style.background = '#440000';
        }
    };

    ui.r.onclick = () => {
        state.repairEnabled = !state.repairEnabled;
        state.saveSettings();
        state.updateUI();
        sendConfigToIframe();
    };

    ui.m.onclick = () => {
        state.equipMode = { 'N': 'A', 'A': 'B', 'B': 'N' }[state.equipMode];
        state.saveSettings();
        state.updateUI();
        sendConfigToIframe();
    };

    ui.d.onclick = () => {
        state.delayMs = (state.delayMs + 500) % 2500;
        state.saveSettings();
        state.updateUI();
        sendConfigToIframe();
    };

    ui.i.onclick = () => {
        const names = ['FREE'].concat((state.availableItems || []).map(x => x.name));
        state.targetHpName = names[(names.indexOf(state.targetHpName) + 1) % names.length] || 'FREE';
        state.saveSettings();
        state.updateUI();
        sendConfigToIframe();
    };

    ui.l.onclick = () => {
        const win = window.open('', '_blank');
        if (!win) return;

        const logs = JSON.parse(localStorage.getItem('tmx_v15_logs') || '{"action":[],"traffic":[]}');

        win.document.write(`
            <html><head><title>Tantora V15 Logs</title></head>
            <body style="background:#111;color:#eee;font-family:monospace;padding:20px;">
                <h1 style="color:#0f0;border-bottom:1px solid:#333;">Action Logs (行動)</h1>
                <pre id="action" style="background:#000;padding:10px;border:1px solid:#444;white-space:pre-wrap;word-break:break-all;"></pre>
                <h1 style="color:#0ff;border-bottom:1px solid:#333;">Traffic Logs (通信)</h1>
                <pre id="traffic" style="background:#000;padding:10px;border:1px solid:#444;white-space:pre-wrap;word-break:break-all;"></pre>
                <button id="saveAction">Actionログを保存</button>
                <button id="saveTraffic">Trafficログを保存</button>
                <script>
                    const logs = ${JSON.stringify(logs)};
                    const actionPre = document.getElementById('action');
                    const trafficPre = document.getElementById('traffic');
                    actionPre.textContent = (logs.action || []).join('\\n');
                    trafficPre.textContent = (logs.traffic || []).join('\\n');

                    function saveText(filename, text) {
                        const blob = new Blob([text], {type: 'text/plain'});
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }

                    document.getElementById('saveAction').onclick = () => {
                        saveText('tantora_action_logs.txt', actionPre.textContent);
                    };
                    document.getElementById('saveTraffic').onclick = () => {
                        saveText('tantora_traffic_logs.txt', trafficPre.textContent);
                    };

                    window.addEventListener('message', (ev) => {
                        if (!ev.data || !ev.data.type || !ev.data.text) return;
                        if (ev.data.type === 'action') {
                            actionPre.textContent += '\\n' + ev.data.text;
                        } else if (ev.data.type === 'traffic') {
                            trafficPre.textContent += '\\n' + ev.data.text;
                        }
                    });
                </script>
            </body></html>
        `);
        win.document.close();
        state.logWindow = win;
    };

    setInterval(() => {
        if (state.updateUI) state.updateUI();
    }, 500);

    state.updateUI();

    // --- 表→iframe 設定送信 ---
    function sendConfigToIframe() {
        const f = state.warIframe;
        if (!f) return;
        f.contentWindow.postMessage({
            type: 'WAR_CONFIG',
            payload: {
                repairEnabled: state.repairEnabled,
                equipMode:     state.equipMode,
                targetHpName:  state.targetHpName,
                delayMs:       state.delayMs
            }
        }, '*');
    }

    // --- iframeからの通知（残数・ログ） ---
    window.addEventListener('message', (ev) => {
        if (!ev.data) return;
        if (ev.data.type === 'HP_REMAIN') {
            const { name, stock } = ev.data.payload;
            const idx = state.availableItems.findIndex(x => x.name === name);
            if (idx >= 0) state.availableItems[idx].stock = stock;
            else state.availableItems.push({ name, stock });
            state.updateUI();
        } else if (ev.data.type === 'LOG_ACTION') {
            state.logs.action.push(ev.data.text);
            state.saveLogs();
            if (state.logWindow && !state.logWindow.closed) {
                state.logWindow.postMessage({ type: 'action', text: ev.data.text }, '*');
            }
        } else if (ev.data.type === 'LOG_TRAFFIC') {
            state.logs.traffic.push(ev.data.text);
            state.saveLogs();
            if (state.logWindow && !state.logWindow.closed) {
                state.logWindow.postMessage({ type: 'traffic', text: ev.data.text }, '*');
            }
        }
    });

    // --- 抗争解析＋1500ms前に iframe 生成（表タブはここまで） ---
    function analyzeMyPage() {
        if (!location.href.includes('/mypage')) return;

        const links = Array.from(document.querySelectorAll('a'));
        const battleLink = links.find(a => a.innerText.includes('と抗争勃発!!'));
        if (!battleLink) return;

        const container = battleLink.parentElement;
        if (!container) return;

        const txt = container.innerText;
        const m = txt.match(/(\d{1,2})[\/月](\d{1,2})[\/日]?\s*(\d{1,2})時(\d{1,2})分開戦/);
        if (!m) return;

        const [, month, day, hour, min] = m;
        const idMatch = battleLink.href.match(/team_id=(\d+)/);
        if (!idMatch) return;

        const teamId = idMatch[1];
        state.teamId = teamId;

        const year = new Date().getFullYear();
        const target = new Date(`${year}/${month}/${day} ${hour}:${min}:00`);
        state.startTime = target.getTime();

        if (state.isTimerRunning) return;
        state.isTimerRunning = true;

        const timer = setInterval(() => {
            if (Date.now() >= state.startTime - 1500) {
                clearInterval(timer);
                createWarIframe();
            }
        }, 100);
    }

    function createWarIframe() {
        if (state.warIframe) return;

        const f = document.createElement('iframe');
        f.style.position = 'fixed';
        f.style.width = '1px';
        f.style.height = '1px';
        f.style.bottom = '0';
        f.style.right = '0';
        f.style.border = '0';
        f.src = `/war/member-list/${state.teamId}`;
        state.warIframe = f;
        document.body.appendChild(f);

        // iframeロード後に設定を送る
        f.onload = () => {
            sendConfigToIframe();
        };
    }

    if (document.readyState === 'complete') {
        analyzeMyPage();
    } else {
        window.addEventListener('load', analyzeMyPage);
    }
})();

/******************************************************
 * ここから：iframe専用エンジン（表タブは絶対触らない）
 ******************************************************/
(function() {
    'use strict';
    if (window === window.parent) return; // 表タブでは動かさない

    const state = window.state;
    const baseFetch = window.originalFetch || window.fetch;

    // --- ログユーティリティ（親へ送る） ---
    function logAction(msg) {
        const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
        state.logs.action.push(line);
        if (state.loggingActive) state.saveLogs();
        parent.postMessage({ type: 'LOG_ACTION', text: line }, '*');
    }

    function logTraffic(msg) {
        const line = `[RECV] ${new Date().toLocaleTimeString()}: ${msg}`;
        state.logs.traffic.push(line);
        if (state.loggingActive) state.saveLogs();
        parent.postMessage({ type: 'LOG_TRAFFIC', text: line }, '*');
    }

    // --- 設定受信（表タブから） ---
    window.addEventListener('message', (ev) => {
        if (!ev.data || ev.data.type !== 'WAR_CONFIG') return;
        const cfg = ev.data.payload;
        if (cfg.repairEnabled !== undefined) state.repairEnabled = cfg.repairEnabled;
        if (cfg.equipMode     !== undefined) state.equipMode     = cfg.equipMode;
        if (cfg.targetHpName  !== undefined) state.targetHpName  = cfg.targetHpName;
        if (cfg.delayMs       !== undefined) state.delayMs       = cfg.delayMs;
        state.saveSettings();
    });

    // --- fetchフック（iframe内だけ） ---
    window.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;

        if (url.includes('/war/battle?other/')) {
            if (state.phase !== 'IDLE') {
                logTraffic(`[BLOCKED] ${url}`);
                return new Response(null, { status: 403 });
            }
            if (state.delayMs > 0) {
                await new Promise(r => setTimeout(r, state.delayMs));
            }
        }

        const resp = await baseFetch.apply(this, args);

        if (url.includes('/war/')) {
            const clone = resp.clone();
            const html = await clone.text();

            if (url.includes('/war/result') || html.includes('抗争は終了しました')) {
                state.loggingActive = false;
                state.saveLogs();
                logAction('抗争終了を検知：ログを確定保存しました。');
                state.isWarActive = false;
                state.phase = 'IDLE';
                // ★ 表タブは触らない：iframe内だけで完結
                document.open();
                document.write(html);
                document.close();
                return resp;
            }

            if (html.includes('<blink>入院中</blink>')) {
                if (state.phase === 'IDLE') {
                    state.phase = 'REPAIR';
                    logAction('入院検知：回復シーケンスを開始します。');
                    if (window.runHealSequence) window.runHealSequence();
                }
            }

            const spMatch = html.match(/sp[^>]*>(\d+)\//i);
            const stMatch = html.match(/st[^>]*>(\d+)\//i);

            if (spMatch && parseInt(spMatch[1], 10) <= 400) {
                if (window.executeStatRecovery) window.executeStatRecovery('SP');
            }
            if (stMatch && parseInt(stMatch[1], 10) === 0) {
                if (window.executeStatRecovery) window.executeStatRecovery('ST');
            }

            logTraffic(url);
        }

        return resp;
    };

    // --- 疑似遷移（iframe内だけ） ---
    async function silentNavigate(url) {
        const resp = await fetch(url);
        const html = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        document.body.innerHTML = doc.body.innerHTML;
        return doc;
    }

    // --- 修理 → HP回復 ---
    window.runHealSequence = async function() {
        state.phase = 'REPAIR';
        if (!state.repairEnabled) {
            window.runHealProcess();
            return;
        }

        await silentNavigate('/item/repair-confirm');

        const wR = setInterval(() => {
            const sub = document.querySelector('input[type="submit"]');
            if (sub) {
                sub.click();
                clearInterval(wR);
                window.runHealProcess();
            } else if (
    document.body.innerText.includes('修理する必要はありません') ||
    document.body.innerText.includes('修理失敗')
) {
    clearInterval(wR);

   // --- 修理 → HP回復 ---
window.runHealSequence = async function() {
    state.phase = 'REPAIR';
    if (!state.repairEnabled) {
        window.runHealProcess();
        return;
    }

    await silentNavigate('/item/repair-confirm');

    const wR = setInterval(() => {
        const sub = document.querySelector('input[type="submit"]');
        if (sub) {
            sub.click();
            clearInterval(wR);
            window.runHealProcess();
        } else if (
            document.body.innerText.includes('修理する必要はありません') ||
            document.body.innerText.includes('修理失敗')
        ) {
            clearInterval(wR);

            document.open();
            document.write(`
                <html>
                <head><title>修理エラー</title></head>
                <body style="background:#111;color:#eee;font-family:sans-serif;padding:20px;">
                    <h1 style="color:#f00;">修理する必要はありません</h1>
                    <p>部品は壊れていないため、修理は不要です。</p>
                    <script>
                        window.history.replaceState({}, '', '/repair-error/');
                    </script>
                </body>
                </html>
            `);
            document.close();

            state.phase = 'IDLE';
            return;
        }
    }, 50);
};


// --- HP回復工程（残数送信付き） ---
window.runHealProcess = async function() {
    state.phase = 'HEAL';
    const targetUrl = state.teamId ? `/war/member-list/${state.teamId}` : '/war/member-list';
    await silentNavigate(targetUrl);

    const wH = setInterval(() => {
        const popup = document.querySelector('.popupWindowContents');
        if (!popup) {
            document.querySelector('img[src*="footer_heal.png"]')?.parentElement?.click();
            return;
        }

        // プリセット選択
        const mIdx = { 'A': 0, 'B': 1, 'N': 2 }[state.equipMode];
        popup.querySelectorAll('input[name="select_preset_radio"]')[mIdx]?.click();

        // アイテム一覧
        const items = Array.from(popup.querySelectorAll('li.itemHP'));
        const target = (state.targetHpName === 'FREE')
            ? items[0]
            : items.find(li => li.innerText.includes(state.targetHpName));

        if (target) {
            // 残数解析 → 親へ送信
            const name = state.targetHpName === 'FREE'
                ? (target.innerText.split('\n')[0] || 'FREE')
                : state.targetHpName;

            const remainMatch = target.innerText.match(/残り(\d+)/);
            const stock = remainMatch ? parseInt(remainMatch[1], 10) : 0;

            parent.postMessage({ type: 'HP_REMAIN', payload: { name, stock } }, '*');

            const isFull = target.innerText.includes('全回復');
            target.click();
            clearInterval(wH);

            // 回復実行
            const wF = setInterval(() => {
                const btn = isFull
                    ? popup.querySelector('input[type="submit"]')
                    : popup.querySelector('a.multi-form-submit');

                if (btn) {
                    btn.click();
                    clearInterval(wF);

                    setTimeout(async () => {
                        const checkDoc = await silentNavigate(window.location.href);
                        if (checkDoc.body.innerHTML.includes('入院中')) {
                            window.runHealProcess();
                        } else {
                            state.phase = 'IDLE';
                        }
                    }, 200);
                }
            }, 50);
        }
    }, 150);
};

    // --- ST/SP回復（iframe内完結） ---
    window.executeStatRecovery = async function(type) {
        if (state.phase !== 'IDLE') return;
        state.phase = 'STAT_HEAL';
        const logLabel = (type === 'ST') ? 'ST' : 'SP';
        logAction(`${logLabel}回復開始`);

        await silentNavigate('/item/use-list');

        let wF = null;
        const wS = setInterval(() => {
            const itemRows = Array.from(document.querySelectorAll('li, .item-box'));
            const targetItem = itemRows.find(row => {
                const text = row.innerText;
                if (/ｈｐ|ＨＰ|hp|HP/.test(text)) return false;
                if (type === 'ST') {
                    return text.includes('ST') && (text.includes('回復') || text.includes('全快'));
                } else if (type === 'SP') {
                    return text.includes('SP') && (text.includes('回復') || text.includes('全快'));
                }
                return false;
            });

            if (targetItem) {
                const useBtn = targetItem.querySelector('a, input[type="submit"], .use-button');
                if (useBtn) {
                    useBtn.click();
                    clearInterval(wS);

                    wF = setInterval(() => {
                        const confirmBtn = document.querySelector('input[type="submit"][value*="使用"], .confirm-button');
                        if (confirmBtn) {
                            confirmBtn.click();
                            clearInterval(wF);

                            setTimeout(async () => {
                                const targetUrl = state.teamId ? `/war/member-list/${state.teamId}` : '/war/member-list';
                                await silentNavigate(targetUrl);
                                state.phase = 'IDLE';
                                logAction(`${logLabel}回復完了・戦線復帰`);
                            }, 200);
                        } else if (document.body.innerText.includes('使用しました')) {
                            clearInterval(wF);
                            setTimeout(async () => {
                                const targetUrl = state.teamId ? `/war/member-list/${state.teamId}` : '/war/member-list';
                                await silentNavigate(targetUrl);
                                state.phase = 'IDLE';
                            }, 200);
                        }
                    }, 50);
                }
            } else {
                if (wF) clearInterval(wF);
            }
        }, 50);
    };

    // --- iframe初期化：抗争ページならロギングON ---
    (function init() {
        if (location.href.includes('/war/member-list/')) {
            state.loggingActive = true;
            state.isWarActive = true;
            logAction('突撃成功 → ロギング開始');
        }
    })();
})();