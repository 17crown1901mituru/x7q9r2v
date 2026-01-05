// ==UserScript==
// @name         Tantora Ultra Engine V15
// @namespace    https://viayoo.com/ekt6gu
// @version      15.11.7
// @match        https://tantora.jp/*
// @author       光琉✞みつる
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // --- [1] 保存キーと設定のロード ---
    const STORAGE_KEY_SETTINGS = 'tmx_v15_settings';
    const STORAGE_KEY_LOGS     = 'tmx_v15_logs';

    const savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || '{}');
    const savedLogs     = JSON.parse(localStorage.getItem(STORAGE_KEY_LOGS) || '{}');

    // --- [2] 共通状態（state）の定義 ---
    window.state = {
        // 司令塔フラグ（将来拡張用）
        flowFlag: 0,      // 0:待機, 1:予約, 2:抗争中

        // 動作設定
        repairEnabled: savedSettings.repairEnabled || false,
        equipMode:     savedSettings.equipMode     || 'N',
        targetHpName:  savedSettings.hpName        || 'FREE',
        delayMs:       savedSettings.delayMs !== undefined ? savedSettings.delayMs : 0,

        // 内部ステータス
        phase:          'IDLE',    // IDLE / REPAIR / HEAL / STAT_HEAL
        availableItems: [],
        enemyTeamId:    null,
        teamId:         null,
        startTime:      null,
        isTimerRunning: false,
        isWarActive:    false,     // 抗争モード中かどうか
        loggingActive:  false,     // ロギング中かどうか

        // ログ記録
        logs: {
            action: Array.isArray(savedLogs.action)  ? savedLogs.action  : [],
            traffic: Array.isArray(savedLogs.traffic) ? savedLogs.traffic : []
        },

        // 設定保存
        saveSettings() {
            localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify({
                repairEnabled: this.repairEnabled,
                equipMode:     this.equipMode,
                hpName:        this.targetHpName,
                delayMs:       this.delayMs
            }));
        },

        // ログ保存
        saveLogs() {
            localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify({
                action: this.logs.action,
                traffic: this.logs.traffic,
                teamId: this.teamId,
                startTime: this.startTime
            }));
        },

        // ログ初期化（新しい抗争開始時）
        resetLogs() {
            this.logs.action = [];
            this.logs.traffic = [];
            this.saveLogs();
        }
    };

    // --- [3] 通信フックの基底準備 ---
    window.originalFetch = window.fetch;

    console.log('TMX Core: V15 recovery system base initialized.');
})();

(function() {
    'use strict';
    const state = window.state;

    // --- [1] UIの構築 (Shadow DOM) ---
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
        r: document.createElement('div'), // Repair ON/OFF
        m: document.createElement('div'), // Mode A/B/N
        d: document.createElement('div'), // Delayトグル
        i: document.createElement('div'), // HP Item Name
        c: document.createElement('div'), // Item Count (Disp)
        l: document.createElement('div')  // Log/Action
    };

    Object.keys(ui).forEach(k => {
        ui[k].className = (k === 'c') ? 'disp' : 'btn';
        root.appendChild(ui[k]);
    });

    // --- [2] UI描画・同期ロジック ---
    state.updateUI = () => {
        // Repair
        ui.r.innerHTML = `Repair<br>${state.repairEnabled ? 'ON' : 'OFF'}`;
        ui.r.style.color = state.repairEnabled ? '#5bc0de' : '#666';

        // Mode (A/B/N)
        ui.m.innerHTML = `Mode<br>${state.equipMode}`;
        ui.m.style.color = { 'A': '#ff0', 'B': '#f00', 'N': '#fff' }[state.equipMode];

        // Delay
        ui.d.innerHTML = `Delay<br>${state.delayMs}`;
        ui.d.style.color = state.delayMs > 0 ? '#ff9900' : '#0f0';

        // HP Item Name (最大10文字)
        const truncatedName = state.targetHpName.substring(0, 10);
        ui.i.innerHTML = `<div style="font-size:8px;">${truncatedName}</div>`;

        // Item Count
        const cur = state.availableItems?.find(x => x.name === state.targetHpName);
        ui.c.innerHTML = `<span style="font-size:13px;">${cur ? cur.stock : '0'}</span>`;

        // Log Button
        if (state.phase === 'IDLE') {
            ui.l.innerHTML = 'LOG<br>SAVE';
            ui.l.style.background = '#004400';
        } else {
            ui.l.innerHTML = 'RECV<br>NOW';
            ui.l.style.background = '#440000';
        }
    };

    // --- [3] イベントハンドラ ---
    ui.r.onclick = () => {
        state.repairEnabled = !state.repairEnabled;
        state.saveSettings();
        state.updateUI();
    };

    ui.m.onclick = () => {
        state.equipMode = { 'N': 'A', 'A': 'B', 'B': 'N' }[state.equipMode];
        state.saveSettings();
        state.updateUI();
    };

    ui.d.onclick = () => {
        state.delayMs = (state.delayMs + 500) % 2500; // 0 -> 500 -> ... -> 2000 -> 0
        state.saveSettings();
        state.updateUI();
    };

    ui.i.onclick = () => {
        const names = ['FREE'].concat((state.availableItems || []).map(x => x.name));
        state.targetHpName = names[(names.indexOf(state.targetHpName) + 1) % names.length] || 'FREE';
        state.saveSettings();
        state.updateUI();
    };

    // ログビューア（別タブ）を開く
    ui.l.onclick = () => {
        const win = window.open('', '_blank');
        if (!win) return;

        const logs = JSON.parse(localStorage.getItem('tmx_v15_logs') || '{"action":[],"traffic":[]}');

        win.document.write(`
            <html><head><title>Tantora V15 Logs</title></head>
            <body style="background:#111;color:#eee;font-family:monospace;padding:20px;">
                <h1 style="color:#0f0;border-bottom:1px solid #333;">Action Logs (行動)</h1>
                <pre id="action" style="background:#000;padding:10px;border:1px solid #444;white-space:pre-wrap;word-break:break-all;"></pre>
                <h1 style="color:#00ffff;border-bottom:1px solid #333;">Traffic Logs (通信)</h1>
                <pre id="traffic" style="background:#000;padding:10px;border:1px solid #444;white-space:pre-wrap;word-break:break-all;"></pre>
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

    // --- [4] UI自己修復 ---
    setInterval(() => {
        if (!document.getElementById('tmx-shadow-container')) {
            // UI が消えたので再生成
            // （この IIFE は一度しか走らないので、ここでは何もしない）
        }
        if (state.updateUI) state.updateUI();
    }, 500);

    state.updateUI();
})();

(function() {
    'use strict';
    const state = window.state;
    const baseFetch = window.originalFetch || window.fetch;

    // --- ログユーティリティ ---
    function logAction(msg) {
        const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
        state.logs.action.push(line);
        if (state.loggingActive) state.saveLogs();
        if (state.logWindow && !state.logWindow.closed) {
            state.logWindow.postMessage({ type: 'action', text: line }, '*');
        }
    }

    function logTraffic(msg) {
        const line = `[RECV] ${new Date().toLocaleTimeString()}: ${msg}`;
        state.logs.traffic.push(line);
        if (state.loggingActive) state.saveLogs();
        if (state.logWindow && !state.logWindow.closed) {
            state.logWindow.postMessage({ type: 'traffic', text: line }, '*');
        }
    }

    // --- [道理] 通信傍受(fetch)のオーバーライド ---
    window.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;

        // 1. 攻撃パケットの制御（表ブラウザの攻撃ツールのみ対象）
        if (url.includes('/war/battle?other/')) {
            if (state.phase !== 'IDLE') {
                logTraffic(`[BLOCKED] ${url}`);
                return new Response(null, { status: 403 });
            }
            if (state.delayMs > 0) {
                await new Promise(r => setTimeout(r, state.delayMs));
            }
        }

        // 2. 通信の実行
        const resp = await baseFetch.apply(this, args);

        // 3. 抗争会場(/war/)に関連する通信の解析
        if (url.includes('/war/')) {
            const clone = resp.clone();
            const html = await clone.text();

            // 【最重要：終了検知】
            if (url.includes('/war/result') || html.includes('抗争は終了しました')) {
                // ログ確定保存
                state.loggingActive = false;
                state.saveLogs();
                logAction('抗争終了を検知：ログを確定保存しました。');

                // 状態を初期化
                state.isWarActive = false;
                state.phase = 'IDLE';

                // リザルト画面を表ブラウザにそのまま描写（表ツールを消す）
                try {
                    document.open();
                    document.write(html);
                    document.close();
                } catch (e) {
                    console.error('Result render failed:', e);
                }

                if (state.updateUI) state.updateUI();
                return resp;
            }

            // 4. 入院検知
            if (html.includes('<blink>入院中</blink>')) {
                if (state.phase === 'IDLE') {
                    state.phase = 'REPAIR';
                    logAction('入院検知：回復シーケンスを開始します。');
                    if (window.runHealSequence) window.runHealSequence();
                }
            }

            // 5. ステータス数値の監視（ST/SP回復へ）
            const spMatch = html.match(/sp[^>]*>(\d+)\//i);
            const stMatch = html.match(/st[^>]*>(\d+)\//i);

            if (spMatch && parseInt(spMatch[1], 10) <= 400) {
                if (window.executeStatRecovery) window.executeStatRecovery('SP');
            }
            if (stMatch && parseInt(stMatch[1], 10) === 0) {
                if (window.executeStatRecovery) window.executeStatRecovery('ST');
            }

            // 通信ログ
            logTraffic(url);
        }

        return resp;
    };
})();

(function() {
    'use strict';
    const state = window.state;

    // --- [1] 疑似遷移関数 ---
    async function silentNavigate(url) {
        const resp = await fetch(url);
        const html = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        document.body.innerHTML = doc.body.innerHTML;
        return doc;
    }

    // --- [2] 修理工程（HP回復へ自動連動） ---
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
            } else if (document.body.innerText.includes('壊れていません')) {
                clearInterval(wR);
                window.runHealProcess();
            }
        }, 50);
    };

    // --- [3] HP回復工程（プリセット・多重・戦地復帰） ---
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

            if (target) {
                const isFull = target.innerText.includes('全回復');
                target.click();
                clearInterval(wH);

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
                                if (state.updateUI) state.updateUI();
                            }
                        }, 200);
                    }
                }, 50);
            }
        }, 150);
    };

    // --- [4] ST/SP回復実行エンジン（HPを含むアイテムを除外） ---
    window.executeStatRecovery = async function(type) {
        if (state.phase !== 'IDLE') return;
        state.phase = 'STAT_HEAL';
        const logLabel = (type === 'ST') ? 'ST' : 'SP';
        state.logs.action.push(`[${new Date().toLocaleTimeString()}] ${logLabel}回復開始`);
        if (state.loggingActive) state.saveLogs();

        await silentNavigate('/item/use-list');

        let wF = null;
        const wS = setInterval(() => {
            const itemRows = Array.from(document.querySelectorAll('li, .item-box'));
            const targetItem = itemRows.find(row => {
                const text = row.innerText;
                // HP を含むアイテムは絶対に除外（全角・小文字も含めて判定）
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
                                state.logs.action.push(`[${new Date().toLocaleTimeString()}] ${logLabel}回復完了・戦線復帰`);
                                if (state.loggingActive) state.saveLogs();
                                if (state.updateUI) state.updateUI();
                            }, 200);
                        } else if (document.body.innerText.includes('使用しました')) {
                            clearInterval(wF);
                            setTimeout(async () => {
                                const targetUrl = state.teamId ? `/war/member-list/${state.teamId}` : '/war/member-list';
                                await silentNavigate(targetUrl);
                                state.phase = 'IDLE';
                                if (state.updateUI) state.updateUI();
                            }, 200);
                        }
                    }, 50);
                }
            } else {
                if (wF) clearInterval(wF);
            }
        }, 50);
    };
})();

(function() {
    'use strict';

    const state = window.state;

    // --- [1] マイページ解析ロジック（抗争予約） ---
    window.analyzeMyPage = async function () {
        if (!location.href.includes('/mypage')) return;

        const links = Array.from(document.querySelectorAll('a'));
        const battleLink = links.find(a => a.innerText.includes('と抗争勃発!!'));
        if (!battleLink) return;

        const container = battleLink.parentElement;
        if (!container) return;

        const containerText = container.innerText;

        // ★ 全フォーマット対応
        const timeMatch = containerText.match(
            /(\d{1,2})[\/月](\d{1,2})[\/日]?\s*(\d{1,2})時(\d{1,2})分開戦/
        );

        if (!timeMatch) {
            state.logs.action.push(
                `[${new Date().toLocaleTimeString()}] 解析失敗: 時刻フォーマット不一致`
            );
            state.saveLogs();
            return;
        }

        const [, month, day, hour, min] = timeMatch;

        // 抗争ID
        const idMatch = battleLink.href.match(/team_id=(\d+)/);
        if (!idMatch) return;

        state.teamId = idMatch[1];
        state.startTime = `${month}/${day} ${hour}:${min}`;

        // ログ
        state.logs.action.push(
            `[${new Date().toLocaleTimeString()}] 解析成功: ID ${state.teamId} / ${hour}:${min}開戦を予約`
        );
        state.saveLogs();

        // ★ ここで isWarActive を true にしない（タイマーが動かなくなるため）

        // --- 開戦時刻をミリ秒に変換 ---
        const nowYear = new Date().getFullYear();
        const targetDate = new Date(`${nowYear}/${month}/${day} ${hour}:${min}:00`);
        const targetMs = targetDate.getTime();

        // --- 突撃タイマー起動 ---
        setupAssaultTimer(targetMs);
    };

    // --- [2] 突撃タイマー ---
    function setupAssaultTimer(targetMs) {
        const assaultOffset = 1500; // 1.5秒前に突撃
        const triggerTime = targetMs - assaultOffset;

        const checkTimer = setInterval(() => {
            const now = Date.now();
            if (now >= triggerTime) {
                clearInterval(checkTimer);
                executeAssault();
            }
        }, 100);
    }

    // --- [3] 突撃実行 ---
    async function executeAssault() {
        if (!state.teamId) {
            state.logs.action.push('突撃エラー: 戦地IDが不明です');
            state.saveLogs();
            return;
        }

        state.logs.action.push(
            `[${new Date().toLocaleTimeString()}] 突撃開始: 会場へ移動します`
        );
        state.saveLogs();

        const warUrl = `/war/member-list/${state.teamId}`;

        try {
            const resp = await fetch(warUrl);
            const html = await resp.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // ページ書き換え
            document.body.innerHTML = doc.body.innerHTML;

            // ★ 抗争開始 → ロギング開始
            state.loggingActive = true;
            state.phase = 'IDLE';
            state.isWarActive = true; // ← ここで true にするのが正しい
            state.saveLogs();

            if (typeof state.updateUI === 'function') state.updateUI();
        } catch (e) {
            state.logs.action.push('突撃失敗: 通信エラーが発生しました');
            state.saveLogs();
        }
    }

    // --- エントリポイント ---
    if (document.readyState === 'complete') {
        window.analyzeMyPage();
    } else {
        window.addEventListener('load', window.analyzeMyPage);
    }
})();