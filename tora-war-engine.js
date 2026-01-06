// ==UserScript==
// @name         Tantora Recovery Engine (Unified)
// @namespace    https://viayoo.com/ekt6gu
// @version      1.0.0
// @match        https://tantora.jp/*
// @author       光琉✞みつる
// @grant        none
// @run-at       document-start
// ==/UserScript==

/******************************************************
 * グローバル state 初期化
 ******************************************************/
(function() {
    'use strict';

    const savedSettings = JSON.parse(localStorage.getItem('tmx_settings') || '{}');
    const savedLogs     = JSON.parse(localStorage.getItem('tmx_logs') || '{}');

    window.state = window.state || {
        // 設定
        repairEnabled: savedSettings.repairEnabled || false,
        equipMode:     savedSettings.equipMode     || 'N',
        targetHpName:  savedSettings.targetHpName  || 'FREE',
        delayMs:       savedSettings.delayMs !== undefined ? savedSettings.delayMs : 0,

        // 抗争状態
        phase:          'IDLE',
        availableItems: [],
        enemyName:      'UNKNOWN',
        teamId:         null,
        enemyTeamId:    null,
        isWarActive:    false,
        loggingActive:  false,
        warIframe:      null,
        lastResult:     null,

        // ログ
        logs: {
            front:   savedLogs.front   || [],
            action:  savedLogs.action  || [],
            traffic: savedLogs.traffic || []
        },

        saveSettings() {
            localStorage.setItem('tmx_settings', JSON.stringify({
                repairEnabled: this.repairEnabled,
                equipMode:     this.equipMode,
                targetHpName:  this.targetHpName,
                delayMs:       this.delayMs
            }));
        },

        saveLogs() {
            localStorage.setItem('tmx_logs', JSON.stringify({
                front:   this.logs.front,
                action:  this.logs.action,
                traffic: this.logs.traffic
            }));
        },

        resetLogs() {
            this.logs.front   = [];
            this.logs.action  = [];
            this.logs.traffic = [];
            this.saveLogs();
        }
    };

    window.originalFetch = window.originalFetch || window.fetch;
})();

/******************************************************
 * セッション管理（最大4件）
 ******************************************************/
(function() {
    'use strict';
    const state = window.state;

    function formatDate() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth()+1).padStart(2,'0');
        const day = String(d.getDate()).padStart(2,'0');
        return `${y}-${m}-${day}`;
    }

    window.saveCurrentSession = function() {
        const sessions = JSON.parse(localStorage.getItem('tmx_sessions') || '{}');
        const key = `${formatDate()}_${state.enemyName}_${state.lastResult || 'UNKNOWN'}`;

        sessions[key] = {
            front: state.logs.front,
            action: state.logs.action,
            traffic: state.logs.traffic,
            timestamp: Date.now()
        };

        localStorage.setItem('tmx_sessions', JSON.stringify(sessions));
    };

    window.cleanupOldSessions = function() {
        let sessions = JSON.parse(localStorage.getItem('tmx_sessions') || '{}');
        const keys = Object.keys(sessions);
        if (keys.length <= 4) return;

        const sorted = keys.sort((a,b) => sessions[a].timestamp - sessions[b].timestamp);
        while (sorted.length > 4) {
            const oldest = sorted.shift();
            delete sessions[oldest];
        }
        localStorage.setItem('tmx_sessions', JSON.stringify(sessions));
    };
})();

/******************************************************
 * 別タブログビュー（セッション選択＋削除＋保存ボタン）
 ******************************************************/
(function() {
    'use strict';

    window.openLogViewer = function() {
        const win = window.open('', '_blank');
        if (!win) return;

        const sessions = JSON.parse(localStorage.getItem('tmx_sessions') || '{}');
        const keys = Object.keys(sessions).sort();
        const latestKey = keys[keys.length - 1] || '';

        win.document.write(`
            <html><head><title>SneakyJS Logs</title></head>
            <body style="background:#111;color:#eee;font-family:monospace;padding:20px;">

                <h1 style="color:#0f0;">ログセッション選択</h1>
                <select id="sessionSelect" style="font-size:16px;padding:4px;">
                    ${keys.map(k => `<option value="${k}" ${k===latestKey?'selected':''}>${k}</option>`).join('')}
                </select>
                <button id="deleteSession">このセッションを削除</button>
                <button id="saveFront">Frontログ保存</button>
                <button id="saveAction">Actionログ保存</button>
                <button id="saveTraffic">Trafficログ保存</button>

                <h2 style="color:#d4b106;">Front Logs</h2>
                <pre id="front" style="background:#000;padding:10px;border:1px solid #444;white-space:pre-wrap;word-break:break-all;"></pre>

                <h2 style="color:#52c41a;">Action Logs</h2>
                <pre id="action" style="background:#000;padding:10px;border:1px solid #444;white-space:pre-wrap;word-break:break-all;"></pre>

                <h2 style="color:#1890ff;">Traffic Logs</h2>
                <pre id="traffic" style="background:#000;padding:10px;border:1px solid #444;white-space:pre-wrap;word-break:break-all;"></pre>

                <script>
                    const sessions = ${JSON.stringify(sessions)};
                    const select = document.getElementById('sessionSelect');
                    const frontPre = document.getElementById('front');
                    const actionPre = document.getElementById('action');
                    const trafficPre = document.getElementById('traffic');

                    function loadSession(key) {
                        const s = sessions[key] || {front:[],action:[],traffic:[]};
                        frontPre.textContent   = (s.front   || []).join('\\n');
                        actionPre.textContent  = (s.action  || []).join('\\n');
                        trafficPre.textContent = (s.traffic || []).join('\\n');
                    }

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

                    loadSession(select.value || "${latestKey}");

                    select.onchange = () => loadSession(select.value);

                    document.getElementById('deleteSession').onclick = () => {
                        const key = select.value;
                        delete sessions[key];
                        localStorage.setItem('tmx_sessions', JSON.stringify(sessions));
                        location.reload();
                    };

                    document.getElementById('saveFront').onclick = () => {
                        saveText('front_logs_' + select.value + '.txt', frontPre.textContent);
                    };
                    document.getElementById('saveAction').onclick = () => {
                        saveText('action_logs_' + select.value + '.txt', actionPre.textContent);
                    };
                    document.getElementById('saveTraffic').onclick = () => {
                        saveText('traffic_logs_' + select.value + '.txt', trafficPre.textContent);
                    };

                    const latestKey = "${latestKey}";
                    window.addEventListener('message', (ev) => {
                        if (select.value !== latestKey) return;
                        if (!ev.data || !ev.data.type || !ev.data.text) return;

                        if (ev.data.type === 'LOG_FRONT') {
                            frontPre.textContent += '\\n' + ev.data.text;
                        }
                        if (ev.data.type === 'LOG_ACTION') {
                            actionPre.textContent += '\\n' + ev.data.text;
                        }
                        if (ev.data.type === 'LOG_TRAFFIC') {
                            trafficPre.textContent += '\\n' + ev.data.text;
                        }
                    });
                </script>

            </body></html>
        `);

        win.document.close();
        window.state.logWindow = win;
    };
})();

/******************************************************
 * 表エンジン（抗争検知・iframe起動）
 ******************************************************/
(function() {
    'use strict';
    if (window.frameElement) return; // 親のみ

    const state = window.state;

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

    // HP残数リアルタイム反映
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

    function detectWarUI() {
        if (!location.href.includes('/war/member-list')) return;

        state.resetLogs();
        state.isWarActive = true;
        state.phase = 'IDLE';

        const enemyName = document.querySelector('.enemyTeamName')?.innerText || 'UNKNOWN';
        state.enemyName = enemyName;

        const iframe = document.createElement('iframe');
        iframe.src = location.href;
        iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;';
        document.body.appendChild(iframe);

        state.warIframe = iframe;
        iframe.onload = () => window.sendConfigToIframe();
    }

    window.addEventListener('DOMContentLoaded', detectWarUI);
})();

/******************************************************
 * 裏エンジン（iframe内）：回復・修理・ST/SP・終了判定
 ******************************************************/
(function() {
    'use strict';
    if (!window.frameElement) return; // iframe内のみ

    const state = window.state;

    function logAction(msg) {
        const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
        state.logs.action.push(line);
        parent.postMessage({ type: 'LOG_ACTION', text: line }, '*');
        state.saveLogs();
    }

    function logTraffic(msg) {
        const line = `[RECV ${new Date().toLocaleTimeString()}] ${msg}`;
        state.logs.traffic.push(line);
        parent.postMessage({ type: 'LOG_TRAFFIC', text: line }, '*');
        state.saveLogs();
    }

    window.addEventListener('message', (ev) => {
        if (!ev.data || ev.data.type !== 'WAR_CONFIG') return;
        const cfg = ev.data.payload || {};

        if (cfg.repairEnabled !== undefined) state.repairEnabled = cfg.repairEnabled;
        if (cfg.equipMode     !== undefined) state.equipMode     = cfg.equipMode;
        if (cfg.targetHpName  !== undefined) state.targetHpName  = cfg.targetHpName;
        if (cfg.delayMs       !== undefined) state.delayMs       = cfg.delayMs;
    });

    const baseFetch = window.fetch;

    window.fetch = async function(...args) {
        const req = args[0];
        const url = typeof req === 'string' ? req : req.url;

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
        const contentType = resp.headers.get('content-type') || '';
        const isHtml = contentType.includes('text/html');

        if (isHtml && url.includes('/war/')) {
            const clone = resp.clone();
            const html = await clone.text();

            const cond1 = url.includes('/war/result');
            const cond2 =
                html.includes('との抗争に勝利した') ||
                html.includes('との抗争に敗北した');
            const cond3 = html.includes('【抗争終了日時】');

            const matchCount = [cond1, cond2, cond3].filter(Boolean).length;

            if (matchCount >= 2) {
                state.loggingActive = false;

                if (html.includes('勝利')) state.lastResult = 'WIN';
                else if (html.includes('敗北')) state.lastResult = 'LOSE';
                else state.lastResult = 'UNKNOWN';

                if (window.saveCurrentSession) window.saveCurrentSession();
                if (window.cleanupOldSessions) window.cleanupOldSessions();

                logAction(`抗争終了を検知：ログを確定保存しました。（${state.lastResult}）`);
                state.isWarActive = false;
                state.phase = 'IDLE';

                parent.postMessage({ type: 'WAR_FINISHED' }, '*');

                if (!location.href.includes('/war/result')) {
                    window.location.href = '/war/result';
                }

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

    async function silentNavigate(url) {
        const resp = await fetch(url);
        const html = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        document.body.innerHTML = doc.body.innerHTML;
        return doc;
    }

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
                return;
            }

            if (
                document.body.innerText.includes('修理する必要はありません') ||
                document.body.innerText.includes('修理失敗')
            ) {
                clearInterval(wR);
                logAction('修理不要または失敗：HP回復へ移行');
                state.phase = 'IDLE';
                window.runHealProcess();
                return;
            }
        }, 50);
    };

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

            const mIdx = { 'A': 0, 'B': 1, 'N': 2 }[state.equipMode];
            popup.querySelectorAll('input[name="select_preset_radio"]')[mIdx]?.click();

            const items = Array.from(popup.querySelectorAll('li.itemHP'));
            const target = (state.targetHpName === 'FREE')
                ? items[0]
                : items.find(li => li.innerText.includes(state.targetHpName));

            if (!target) return;

            const name = state.targetHpName === 'FREE'
                ? (target.innerText.split('\n')[0] || 'FREE')
                : state.targetHpName;

            const remainMatch = target.innerText.match(/残り(\d+)/);
            const stock = remainMatch ? parseInt(remainMatch[1], 10) : 0;

            parent.postMessage({ type: 'HP_REMAIN', payload: { name, stock } }, '*');

            const isFull = target.innerText.includes('全回復');
            target.click();
            clearInterval(wH);

            const wF = setInterval(() => {
                const btn = isFull
                    ? popup.querySelector('input[type="submit"]')
                    : popup.querySelector('a.multi-form-submit');

                if (!btn) return;

                btn.click();
                clearInterval(wF);

                setTimeout(async () => {
                    const checkDoc = await silentNavigate(window.location.href);
                    if (checkDoc.body.innerHTML.includes('入院中')) {
                        window.runHealProcess();
                    } else {
                        state.phase = 'IDLE';
                        logAction('HP回復完了・戦線復帰');
                    }
                }, 200);
            }, 50);
        }, 150);
    };

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
                                const targetUrl = state.teamId ? `/war/member-list/${state.teamId}` : '/war/member-list`;
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

    (function init() {
        if (location.href.includes('/war/member-list/')) {
            state.loggingActive = true;
            state.isWarActive = true;
            logAction('突撃成功 → ロギング開始');
        }
    })();
})();

/******************************************************
 * UI（右上パネル）
 ******************************************************/
(function() {
    'use strict';
    if (window.frameElement) return; // 親のみ

    const state = window.state;

    if (document.getElementById('tmx-shadow-container')) return;

    const container = document.createElement('div');
    container.id = 'tmx-shadow-container';

    let shadow;
    try {
        shadow = container.attachShadow({mode: 'open'});
    } catch (e) {
        shadow = container;
    }

    document.documentElement.appendChild(container);

    const root = document.createElement('div');
    root.style.cssText =
        'position:fixed!important;top:10px!important;right:2px!important;z-index:2147483647!important;width:54px!important;display:flex!important;flex-direction:column!important;gap:4px!important;';

    const style = document.createElement('style');
    style.textContent = `
        .btn { width: 54px; height: 48px; background: #000; border: 1px solid #666;
               font-size: 10px; text-align: center; cursor: pointer; font-weight: bold;
               color: #fff; display: flex; flex-direction: column; align-items: center;
               justify-content: center; line-height: 1.2; border-radius: 3px; overflow: hidden; }
        .disp { width: 54px; height: 32px; background: #111; border: 1px solid #444;
                font-size: 10px; text-align: center; color: #0f0; display: flex;
                align-items: center; justify-content: center; border-radius: 3px;
                font-weight: bold; }
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

        const cur = (state.availableItems || []).find(x => x.name === state.targetHpName);
        ui.c.innerHTML = `<span style="font-size:13px;">${cur ? cur.stock : '0'}</span>`;

        if (state.phase === 'IDLE') {
            ui.l.innerHTML = 'LOG<br>VIEW';
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

    ui.l.onclick = () => {
        if (window.openLogViewer) {
            window.openLogViewer();
        } else {
            alert('LogViewer 未統合');
        }
    };

    setInterval(() => {
        if (state.updateUI) state.updateUI();
    }, 500);

    state.updateUI();
})();