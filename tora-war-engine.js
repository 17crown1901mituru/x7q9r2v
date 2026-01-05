// ==UserScript==
// @name         Tantora Ultra Engine V15
// @version      15.11.6
// @match        https://tantora.jp/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

/* ---------------------------------------------------------
   [FILE 1] Core + State
--------------------------------------------------------- */
(function() {
    'use strict';

    const STORAGE_KEY = 'tmx_v15_settings';
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

    window.state = {
        flowFlag: 0,
        repairEnabled: saved.repairEnabled || false,
        equipMode: saved.equipMode || "N",
        targetHpName: saved.hpName || 'FREE',
        delayMs: saved.delayMs !== undefined ? saved.delayMs : 0,

        phase: 'IDLE',
        availableItems: [],
        enemyTeamId: null,
        startTime: null,
        isTimerRunning: false,
        isWarActive: false,
        teamId: null,

        logs: { action: [], traffic: [] },

        save() {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                repairEnabled: this.repairEnabled,
                equipMode: this.equipMode,
                hpName: this.targetHpName,
                delayMs: this.delayMs
            }));
        }
    };

    window.originalFetch = window.fetch;

    console.log("TMX Core: V15 system base initialized.");
})();

/* ---------------------------------------------------------
   [FILE 2] UI
--------------------------------------------------------- */
(function() {
    'use strict';
    const state = window.state;

    function createUI() {
        if (document.getElementById('tmx-shadow-container')) return;

        const container = document.createElement('div');
        container.id = 'tmx-shadow-container';
        const shadow = container.attachShadow({mode: 'open'});
        document.documentElement.appendChild(container);

        const root = document.createElement('div');
        root.style.cssText = `
            position:fixed!important;top:10px!important;right:2px!important;
            z-index:2147483647!important;width:54px!important;
            display:flex!important;flex-direction:column!important;gap:4px!important;
        `;

        const style = document.createElement('style');
        style.textContent = `
            .btn { width: 54px; height: 48px; background: #000; border: 1px solid #666;
                   font-size: 10px; text-align: center; cursor: pointer; font-weight: bold;
                   color: #fff; display: flex; flex-direction: column; align-items: center;
                   justify-content: center; line-height: 1.2; border-radius: 3px; }
            .disp { width: 54px; height: 32px; background: #111; border: 1px solid #444;
                    font-size: 10px; text-align: center; color: #0f0; display: flex;
                    align-items: center; justify-content: center; border-radius: 3px; }
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
            ui.m.style.color = {A:'#ff0',B:'#f00',N:'#fff'}[state.equipMode];

            ui.d.innerHTML = `Delay<br>${state.delayMs}`;
            ui.d.style.color = state.delayMs > 0 ? '#ff9900' : '#0f0';

            ui.i.innerHTML = `<div style="font-size:8px;">${state.targetHpName.substring(0,10)}</div>`;

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

        ui.r.onclick = () => { state.repairEnabled = !state.repairEnabled; state.updateUI(); };
        ui.m.onclick = () => { state.equipMode = {N:"A",A:"B",B:"N"}[state.equipMode]; state.updateUI(); };
        ui.d.onclick = () => { state.delayMs = (state.delayMs + 500) % 2500; state.updateUI(); };
        ui.i.onclick = () => {
            const names = ['FREE'].concat((state.availableItems || []).map(x => x.name));
            state.targetHpName = names[(names.indexOf(state.targetHpName)+1)%names.length] || 'FREE';
            state.updateUI();
        };
        ui.l.onclick = () => {
            const win = window.open("", "_blank");
            win.document.write(`<pre>${state.logs.action.join('\n')}</pre>`);
            win.document.close();
        };

        state.updateUI();
    }

    createUI();

    setInterval(() => {
        if (!document.getElementById('tmx-shadow-container')) createUI();
        if (state.updateUI) state.updateUI();
    }, 500);

})();

/* ---------------------------------------------------------
   [FILE 3] fetch フック
--------------------------------------------------------- */
(function() {
    'use strict';
    const state = window.state;
    const baseFetch = window.fetch;

    window.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;

        if (url.includes('/war/battle?other/')) {
            if (state.phase !== 'IDLE') {
                state.logs.traffic.push(`[BLOCKED] ${new Date().toLocaleTimeString()}: ${url}`);
                return new Response(null, {status:403});
            }
            if (state.delayMs > 0) await new Promise(r => setTimeout(r, state.delayMs));
        }

        const resp = await baseFetch.apply(this, args);

        if (url.includes('/war/')) {
            const clone = resp.clone();
            const html = await clone.text();

            if (url.includes('/war/result') || html.includes('抗争は終了しました')) {
                state.isWarActive = false;
                state.phase = 'IDLE';
                if (state.updateUI) state.updateUI();
                return resp;
            }

            if (html.includes('<blink>入院中</blink>')) {
                if (state.phase === 'IDLE') {
                    state.phase = 'REPAIR';
                    if (window.runHealSequence) window.runHealSequence();
                }
            }

            const spMatch = html.match(/sp[^>]*>(\d+)\//i);
            const stMatch = html.match(/st[^>]*>(\d+)\//i);

            if (spMatch && parseInt(spMatch[1]) <= 400) {
                if (window.executeStatRecovery) window.executeStatRecovery('SP');
            }
            if (stMatch && parseInt(stMatch[1]) === 0) {
                if (window.executeStatRecovery) window.executeStatRecovery('ST');
            }

            state.logs.traffic.push(`[RECV] ${new Date().toLocaleTimeString()}: ${url}`);
        }

        return resp;
    };
})();

/* ---------------------------------------------------------
   [FILE 4] 回復エンジン（修理 → HP → ST/SP）
--------------------------------------------------------- */
(function() {
    'use strict';
    const state = window.state;

    async function silentNavigate(url) {
        const resp = await fetch(url);
        const html = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html,'text/html');
        document.body.innerHTML = doc.body.innerHTML;
        return doc;
    }

    window.runHealSequence = async function() {
        state.phase = 'REPAIR';
        if (!state.repairEnabled) return window.runHealProcess();

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

    window.runHealProcess = async function() {
        state.phase = 'HEAL';

        const targetUrl = state.teamId ? `/war/member-list/${state.teamId}` : '/war/member-list';
        await silentNavigate(targetUrl);

        const wH = setInterval(() => {
            const popup = document.querySelector('.popupWindowContents');
            if (!popup) {
                document.querySelector('img[src*="footer_heal.png"]')?.parentElement.click();
                return;
            }

            const mIdx = {A:0,B:1,N:2}[state.equipMode];
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

    window.executeStatRecovery = async function(type) {
        if (state.phase !== 'IDLE') return;
        state.phase = 'STAT_HEAL';

        await silentNavigate('/item/use-list');

        let wF = null;

        const wS = setInterval(() => {
            const itemRows = Array.from(document.querySelectorAll('li, .item-box'));
            const targetItem = itemRows.find(row => {
                const text = row.innerText;
                if (type === 'ST') return text.includes('ST') && (text.includes('回復') || text.includes('全快'));
                if (type === 'SP') return text.includes('SP') && (text.includes('回復') || text.includes('全快'));
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

/* ---------------------------------------------------------
   [FILE 5] 司令塔（マイページ解析 → 開戦予約 → 突撃）
--------------------------------------------------------- */
(function() {
    'use strict';
    const state = window.state;

    async function silentNavigate(url) {
        const resp = await fetch(url);
        const html = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html,'text/html');
        document.body.innerHTML = doc.body.innerHTML;
        return doc;
    }

    window.analyzeMyPage = async function() {
        if (state.isWarActive || !location.href.includes('/mypage')) return;

        const links = Array.from(document.querySelectorAll('a'));
        const battleLink = links.find(a => a.innerText.includes('と抗争勃発!!'));

        if (battleLink) {
            const idMatch = battleLink.href.match(/team_id=(\d+)/);
            const containerText = battleLink.parentElement.innerText;
            const timeMatch = containerText.match(/(\d+)月(\d+)日\s*(\d+)時(\d+)分開戦/);

            if (idMatch && timeMatch) {
                state.teamId = idMatch[1];

                const [_, month, day, hour, min] = timeMatch;
                const now = new Date();
                state.startTime = new Date(now.getFullYear(), month-1, day, hour, min, 0).getTime();

                state.isWarActive = true;

                setupAssaultTimer(state.startTime);
            }
        }
    };

    function setupAssaultTimer(targetMs) {
        const assaultOffset = 1500;
        const triggerTime = targetMs - assaultOffset;

        const checkTimer = setInterval(() => {
            if (Date.now() >= triggerTime) {
                clearInterval(checkTimer);
                executeAssault();
            }
        }, 100);
    }

    async function executeAssault() {
        if (!state.teamId) return;

        const warUrl = `/war/member-list/${state.teamId}`;

        try {
            const resp = await fetch(warUrl);
            const html = await resp.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html,'text/html');

            document.body.innerHTML = doc.body.innerHTML;

            state.phase = 'IDLE';
            if (state.updateUI) state.updateUI();

        } catch (e) {
            state.logs.action.push("突撃失敗: 通信エラー");
        }
    }

    if (document.readyState === 'complete') {
        window.analyzeMyPage();
    } else {
        window.addEventListener('load', window.analyzeMyPage);
    }

})();