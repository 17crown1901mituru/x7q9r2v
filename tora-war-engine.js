// ==UserScript==
// @name         Tantora Ultra Engine V15
// @version      15.11.6
// @match        https://tantora.jp/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // --- [1] 保存キーと設定のロード ---
    const STORAGE_KEY = 'tmx_v15_settings';
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

    // --- [2] 共通状態（state）の定義 ---
    // ナンバー順に繋ぐファイル1〜4が共通して参照する唯一の容れ物
    window.state = {
        // 司令塔フラグ（ファイル4が分岐に使用）
        flowFlag: 0,      // 0:待機, 1:予約, 2:抗争中
        
        // 動作設定（ファイル1で変更、2・3・4で参照）
        repairEnabled: saved.repairEnabled || false,
        equipMode: saved.equipMode || "N", 
        targetHpName: saved.hpName || 'FREE',
        delayMs: saved.delayMs !== undefined ? saved.delayMs : 0, 
        
        // 内部ステータス（共有用）
        phase: 'IDLE',    
        availableItems: [],
        enemyTeamId: null,
        startTime: null,
        isTimerRunning: false,
        
        // ログ記録
        logs: { 
            action: [], 
            traffic: [] 
        },

        // 設定保存関数（各ファイルから呼び出し可能）
        save: function() {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                repairEnabled: this.repairEnabled,
                equipMode: this.equipMode,
                hpName: this.targetHpName,
                delayMs: this.delayMs
            }));
        }
    };

    // --- [3] 通信フックの基底準備 ---
    // originalFetchを確保し、ファイル2以降での数珠繋ぎを可能にする
    window.originalFetch = window.fetch;

    console.log("TMX Core: V15 system base initialized.");

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
    root.style.cssText = `position:fixed!important;top:10px!important;right:2px!important;z-index:2147483647!important;width:54px!important;display:flex!important;flex-direction:column!important;gap:4px!important;`;
    
    const style = document.createElement('style');
    style.textContent = `
        .btn { width: 54px; height: 48px; background: #000; border: 1px solid #666; font-size: 10px; text-align: center; cursor: pointer; font-weight: bold; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.2; border-radius: 3px; overflow: hidden; }
        .disp { width: 54px; height: 32px; background: #111; border: 1px solid #444; font-size: 10px; text-align: center; color: #0f0; display: flex; align-items: center; justify-content: center; border-radius: 3px; font-weight: bold; }
        .btn:active { background: #333; }
    `;
    shadow.appendChild(style); shadow.appendChild(root);

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

        // 【修正】Delayトグル表示の動的更新
        // D:0, D:500... と表示し、0以外の時は警告色（オレンジ）にする
        ui.d.innerHTML = `Delay<br>${state.delayMs}`;
        ui.d.style.color = state.delayMs > 0 ? '#ff9900' : '#0f0';

        // HP Item Name (最大10文字)
        const truncatedName = state.targetHpName.substring(0, 10);
        ui.i.innerHTML = `<div style="font-size:8px;">${truncatedName}</div>`;

        // Item Count (同期表示)
        // ※state.availableItems はファイル2や3の解析によって動的に更新される想定
        const cur = state.availableItems?.find(x => x.name === state.targetHpName);
        ui.c.innerHTML = `<span style="font-size:13px;">${cur ? cur.stock : '0'}</span>`;

        // Log Button (状態によってラベル変化)
        // phaseがIDLEなら保存待ち、それ以外（REPAIR/HEAL）なら「RECV(回復中)」
        if (state.phase === 'IDLE') {
            ui.l.innerHTML = 'LOG<br>SAVE';
            ui.l.style.background = '#004400';
        } else {
            ui.l.innerHTML = 'RECV<br>NOW';
            ui.l.style.background = '#440000';
        }
    };

    // --- [3] イベントハンドラ ---
    ui.r.onclick = () => { state.repairEnabled = !state.repairEnabled; state.updateUI(); };
    
    ui.m.onclick = () => { 
        state.equipMode = {"N":"A","A":"B","B":"N"}[state.equipMode]; 
        state.updateUI(); 
    };

    ui.d.onclick = () => { 
        // 0 -> 500 -> 1000 -> 1500 -> 2000 -> 0 
        state.delayMs = (state.delayMs + 500) % 2500; 
        state.updateUI(); 
    };

    ui.i.onclick = () => {
        // アイテムリストを同期的にトグル（アイテムが見つからない場合はFREE固定）
        const names = ['FREE'].concat((state.availableItems || []).map(x => x.name));
        state.targetHpName = names[(names.indexOf(state.targetHpName) + 1) % names.length] || 'FREE';
        state.updateUI();
    };

    ui.l.onclick = () => {
        const win = window.open("", "_blank");
        const actionLogs = state.logs.action.slice().reverse().join('\n');
        const trafficLogs = state.logs.traffic.slice().reverse().join('\n');
        
        win.document.write(`
            <html><head><title>Tantora V15 Logs</title></head>
            <body style="background:#111;color:#eee;font-family:monospace;padding:20px;">
                <h1 style="color:#0f0;border-bottom:1px solid #333;">Action Logs (行動)</h1>
                <pre style="background:#000;padding:10px;border:1px solid #444;">${actionLogs}</pre>
                <h1 style="color:#00ffff;border-bottom:1px solid #333;">Traffic Logs (通信)</h1>
                <pre style="background:#000;padding:10px;border:1px solid #444;">${trafficLogs}</pre>
                <button onclick="window.print()">このページを保存する</button>
            </body></html>
        `);
        win.document.close();
    };

    setInterval(() => {
    if (!document.getElementById('tmx-shadow-container')) {
        // UI が消えたので再生成
        createUI();
    }
    state.updateUI();
}, 500);

})();   // ★★★ これが絶対に必要（UIパートの終了）

(function() {
    'use strict';
    const state = window.state;
    const baseFetch = window.fetch;

    /**
     * [道理] 通信傍受(fetch)のオーバーライド
     */
    window.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;

        // 1. 攻撃パケットの制御
        if (url.includes('/war/battle?other/')) {
            // phaseがIDLE（ファイル4の突撃完了後）でなければ物理遮断(403)
            if (state.phase !== 'IDLE') {
                state.logs.traffic.push(`[BLOCKED] ${new Date().toLocaleTimeString()}: ${url}`);
                return new Response(null, { status: 403 });
            }
            // ディレイ設定がある場合は待機（ファイル1のDelayボタンと連動）
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
            // リザルト画面への遷移、またはHTML内に終了メッセージを確認した場合
            if (url.includes('/war/result') || html.includes('抗争は終了しました')) {
                // ファイル4の「解析ロック」を解除
                state.isWarActive = false;
                // 状態を初期化
                state.phase = 'IDLE';
                state.logs.action.push(`[${new Date().toLocaleTimeString()}] 抗争終了を検知：解析ロックを解除しました。`);
                
                // UIを即時更新（ファイル1のupdateUIを呼び出し）
                if (state.updateUI) state.updateUI();
                return resp;
            }

            // 4. 入院検知
            if (html.includes('<blink>入院中</blink>')) {
                if (state.phase === 'IDLE') {
                    state.phase = 'REPAIR'; // UIが「RECV NOW」に変わる
                    state.logs.action.push("入院検知：回復シーケンスを開始します。");
                    if (window.runHealSequence) window.runHealSequence();
                }
            }

            // 5. ステータス数値の監視（ファイル3の回復ロジックへ繋ぐ）
            const spMatch = html.match(/sp[^>]*>(\d+)\//i);
            const stMatch = html.match(/st[^>]*>(\d+)\//i);
            
            if (spMatch && parseInt(spMatch[1]) <= 400) {
                if (window.executeStatRecovery) window.executeStatRecovery('SP');
            }
            if (stMatch && parseInt(stMatch[1]) === 0) {
                if (window.executeStatRecovery) window.executeStatRecovery('ST');
            }

            // 通信ログの記録（ファイル1のログボタンで閲覧可能）
            state.logs.traffic.push(`[RECV] ${new Date().toLocaleTimeString()}: ${url}`);
        }

        return resp;
    };
})();

(function() {
    'use strict';
    const state = window.state;

    // --- [1] 旧版継承：疑似遷移関数 ---
    async function silentNavigate(url) {
        const resp = await fetch(url);
        const html = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        document.body.innerHTML = doc.body.innerHTML;
        return doc;
    }

    // --- [2] 旧版継承：修理工程（HP回復へ自動連動） ---
    window.runHealSequence = async function() {
        state.phase = 'REPAIR';
        if (!state.repairEnabled) { window.runHealProcess(); return; }

        await silentNavigate('/item/repair-confirm');

        const wR = setInterval(() => {
            const sub = document.querySelector('input[type="submit"]');
            if (sub) {
                sub.click(); 
                clearInterval(wR); 
                window.runHealProcess(); // 修理完了後、即座に回復工程へ
            } else if (document.body.innerText.includes('壊れていません')) {
                clearInterval(wR);
                window.runHealProcess();
            }
        }, 50);
    };

    // --- [3] 旧版継承：HP回復工程（プリセット・多重・戦地復帰） ---
    window.runHealProcess = async function() {
        state.phase = 'HEAL';
        // 【道理】ファイル4がマイページから抜き出した teamId を使用して戦地へ直行する
        const targetUrl = state.teamId ? `/war/member-list/${state.teamId}` : '/war/member-list';
        await silentNavigate(targetUrl);

        const wH = setInterval(() => {
            const popup = document.querySelector('.popupWindowContents');
            if (!popup) {
                document.querySelector('img[src*="footer_heal.png"]')?.parentElement.click();
                return;
            }

            // プリセット選択
            const mIdx = {"A":0, "B":1, "N":2}[state.equipMode];
            popup.querySelectorAll('input[name="select_preset_radio"]')[mIdx]?.click();

            const items = Array.from(popup.querySelectorAll('li.itemHP'));
            const target = (state.targetHpName === 'FREE') ? items[0] : items.find(li => li.innerText.includes(state.targetHpName));

            if (target) {
                const isFull = target.innerText.includes('全回復');
                target.click();
                clearInterval(wH);

                const wF = setInterval(() => {
                    // 多重フォーム分岐（旧版のボタン使い分けを完全移植）
                    const btn = isFull ? popup.querySelector('input[type="submit"]') : popup.querySelector('a.multi-form-submit');
                    if (btn) {
                        btn.click();
                        clearInterval(wF);
                        setTimeout(async () => {
                            const checkDoc = await silentNavigate(window.location.href);
                            // 完治判定とループ処理
                            if (checkDoc.body.innerHTML.includes('入院中')) {
                                window.runHealProcess(); 
                            } else {
                                state.phase = 'IDLE'; 
                                if (state.updateUI) state.updateUI();
                            }
                        }, 200); // 旧版の判定ラグ
                    }
                }, 50);
            }
        }, 150); // 旧版の監視周期
    };

   (function() {
    'use strict';
    const state = window.state;

    // --- [1] 旧版継承：疑似遷移関数 ---
    async function silentNavigate(url) {
        const resp = await fetch(url);
        const html = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        document.body.innerHTML = doc.body.innerHTML;
        return doc;
    }

    // --- [2] 旧版継承：修理工程（HP回復へ自動連動） ---
    window.runHealSequence = async function() {
        state.phase = 'REPAIR';
        if (!state.repairEnabled) { window.runHealProcess(); return; }

        await silentNavigate('/item/repair-confirm');

        const wR = setInterval(() => {
            const sub = document.querySelector('input[type="submit"]');
            if (sub) {
                sub.click(); 
                clearInterval(wR); 
                window.runHealProcess(); // 修理完了後、即座に回復工程へ
            } else if (document.body.innerText.includes('壊れていません')) {
                clearInterval(wR);
                window.runHealProcess();
            }
        }, 50);
    };

    // --- [3] 旧版継承：HP回復工程（プリセット・多重・戦地復帰） ---
    window.runHealProcess = async function() {
        state.phase = 'HEAL';
        // 【道理】ファイル4がマイページから抜き出した teamId を使用して戦地へ直行する
        const targetUrl = state.teamId ? `/war/member-list/${state.teamId}` : '/war/member-list';
        await silentNavigate(targetUrl);

        const wH = setInterval(() => {
            const popup = document.querySelector('.popupWindowContents');
            if (!popup) {
                document.querySelector('img[src*="footer_heal.png"]')?.parentElement.click();
                return;
            }

            // プリセット選択
            const mIdx = {"A":0, "B":1, "N":2}[state.equipMode];
            popup.querySelectorAll('input[name="select_preset_radio"]')[mIdx]?.click();

            const items = Array.from(popup.querySelectorAll('li.itemHP'));
            const target = (state.targetHpName === 'FREE') ? items[0] : items.find(li => li.innerText.includes(state.targetHpName));

            if (target) {
                const isFull = target.innerText.includes('全回復');
                target.click();
                clearInterval(wH);

                const wF = setInterval(() => {
                    // 多重フォーム分岐（旧版のボタン使い分けを完全移植）
                    const btn = isFull ? popup.querySelector('input[type="submit"]') : popup.querySelector('a.multi-form-submit');
                    if (btn) {
                        btn.click();
                        clearInterval(wF);
                        setTimeout(async () => {
                            const checkDoc = await silentNavigate(window.location.href);
                            // 完治判定とループ処理
                            if (checkDoc.body.innerHTML.includes('入院中')) {
                                window.runHealProcess(); 
                            } else {
                                state.phase = 'IDLE'; 
                                if (state.updateUI) state.updateUI();
                            }
                        }, 200); // 旧版の判定ラグ
                    }
                }, 50);
            }
        }, 150); // 旧版の監視周期
    };

    (function() {
    'use strict';
    const state = window.state;

    // --- [4] ステータス回復実行エンジン（旧版完全移植） ---
    window.executeStatRecovery = async function(type, current, max) {
        // 重複発火の防止
        if (state.phase !== 'IDLE') return;
        state.phase = 'STAT_HEAL';
        state.logs.action.push(`[${new Date().toLocaleTimeString()}] ${type}回復開始`);

        // リロードを介さずアイテムリストへ疑似遷移
        await silentNavigate('/item/use-list');
let wF = null;

const wS = setInterval(() => {

    const itemRows = Array.from(document.querySelectorAll('li, .item-box'));
    const targetItem = itemRows.find(row => {
        const text = row.innerText;
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
                        state.logs.action.push(`[${new Date().toLocaleTimeString()}] ${type}回復完了・戦線復帰`);
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
        // ★ targetItem が無かった時の後処理
        if (wF) clearInterval(wF);
    }

}, 50);

(function() {
    'use strict';
    const state = window.state;

    /**
     * [道理1] マイページ解析ロジック
     * 抗争中フラグ(isWarActive)が false の時のみ実行される。
     * 特定テキスト「と抗争勃発!!」を持つリンクから team_id を特定し、
     * 同一要素内のテキストから開戦時刻を予約する。
     */
    window.analyzeMyPage = async function() {
        // 抗争中モード(true)であれば解析をスキップして負荷を抑える
        // また、マイページURL以外では動作させない
        if (state.isWarActive || !location.href.includes('/mypage')) return;

        // ページ内の全リンクから「nと抗争勃発!!」を含むものを特定
        const links = Array.from(document.querySelectorAll('a'));
        const battleLink = links.find(a => a.innerText.includes('と抗争勃発!!'));

        if (battleLink) {
            // [抽出] href="/team/other?team_id=n" 等から数字のみを抜き出す
            const idMatch = battleLink.href.match(/team_id=(\d+)/);
            
            // [抽出] 同一親要素のテキストから「0/0 n時n分開戦」を抜き出す
            const containerText = battleLink.parentElement.innerText;
            const timeMatch = containerText.match(/(\d+)月(\d+)日\s*(\d+)時(\d+)分開戦/);
            
            if (idMatch && timeMatch) {
                // データの保持
                state.teamId = idMatch[1];
                const [_, month, day, hour, min] = timeMatch;
                const now = new Date();
                state.startTime = new Date(now.getFullYear(), month - 1, day, hour, min, 0).getTime();

                // 【フラグ管理】解析成功を以て「抗争モード」をONにする
                // これにより、以降のマイページ読み込みでは解析が走らなくなる
                state.isWarActive = true; 
                state.logs.action.push(`[${new Date().toLocaleTimeString()}] 解析成功: ID ${state.teamId} / ${hour}:${min}開戦を予約`);
                
                // 突撃タイマーをセット
                setupAssaultTimer(state.startTime);
            }
        }
    };

    /**
     * [道理2] 突撃タイマー
     * サーバー上の開戦時刻に対し、1.5秒(1500ms)の猶予を持ってトリガーを引く。
     */
    function setupAssaultTimer(targetMs) {
        const assaultOffset = 1500;
        const triggerTime = targetMs - assaultOffset;

        // 100ms周期で時刻をチェック
        const checkTimer = setInterval(() => {
            const now = Date.now();
            if (now >= triggerTime) {
                clearInterval(checkTimer);
                executeAssault();
            }
        }, 100);
    }

    /**
     * [道理3] 突撃実行 (Assault)
     * 保持したIDを使い、抗争会場(/war/member-list/n)へ疑似遷移する。
     */
    async function executeAssault() {
        if (!state.teamId) {
            state.logs.action.push("突撃エラー: 戦地IDが不明です");
            return;
        }

        state.logs.action.push(`[${new Date().toLocaleTimeString()}] 突撃開始: 会場へ移動します`);
        
        // 取得した team_id を抗争会場のURLパスへ変換
        const warUrl = `/war/member-list/${state.teamId}`;
        
        try {
            // リロードなしで会場のHTMLを取得し、DOMを入れ替える(疑似遷移)
            const resp = await fetch(warUrl);
            const html = await resp.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // ページ内容を戦地に書き換える
            document.body.innerHTML = doc.body.innerHTML;

            // 遷移完了後、物理遮断(phase)を解除して、ファイル2の攻撃を許可する
            state.phase = 'IDLE';
            state.logs.action.push("突撃完了: IDLEフェーズ移行。攻撃を開始します。");
            
            // UI更新関数があれば呼ぶ
            if (typeof state.updateUI === 'function') state.updateUI();
        } catch (e) {
            state.logs.action.push("突撃失敗: 通信エラーが発生しました");
        }
    }

    // --- エントリポイント ---
    // DOMの構築完了を待って解析を開始
    if (document.readyState === 'complete') {
        window.analyzeMyPage();
    } else {
        window.addEventListener('load', window.analyzeMyPage);
    }

})();