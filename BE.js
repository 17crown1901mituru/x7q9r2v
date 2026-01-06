/******************************************************
 * 裏エンジン（iframe内）：回復・修理・ST/SP・終了判定
 ******************************************************/
(function() {
    if (window === window.parent) return; // iframe内のみ

    const state = window.state;

    /******************************************************
     * ログ関数（iframe → 親へ送信）
     ******************************************************/
    function logAction(msg) {
        const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
        state.logs.action.push(line);
        parent.postMessage({ type: 'LOG_ACTION', text: line }, '*');
    }

    function logTraffic(msg) {
        const line = `[RECV ${new Date().toLocaleTimeString()}] ${msg}`;
        state.logs.traffic.push(line);
        parent.postMessage({ type: 'LOG_TRAFFIC', text: line }, '*');
    }

    /******************************************************
     * WAR_CONFIG 受信（表 → 裏）
     ******************************************************/
    window.addEventListener('message', (ev) => {
        if (!ev.data || ev.data.type !== 'WAR_CONFIG') return;
        const cfg = ev.data.payload;

        if (cfg.repairEnabled !== undefined) state.repairEnabled = cfg.repairEnabled;
        if (cfg.equipMode     !== undefined) state.equipMode     = cfg.equipMode;
        if (cfg.targetHpName  !== undefined) state.targetHpName  = cfg.targetHpName;
        if (cfg.delayMs       !== undefined) state.delayMs       = cfg.delayMs;
    });

    /******************************************************
     * fetch フック（iframe内のみ・新仕様）
     ******************************************************/
    const baseFetch = window.fetch;

    window.fetch = async function(...args) {
        const req = args[0];
        const url = typeof req === 'string' ? req : req.url;

        // ★ 攻撃リクエスト制御（回復中はブロック）
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

            /******************************************************
             * ★ 抗争終了判定（実データ準拠）
             ******************************************************/
            const cond1 = url.includes('/war/result');
            const cond2 =
                html.includes('との抗争に勝利した') ||
                html.includes('との抗争に敗北した');
            const cond3 = html.includes('【抗争終了日時】');

            const matchCount = [cond1, cond2, cond3].filter(Boolean).length;

            if (matchCount >= 2) {
                state.loggingActive = false;

                // 結果を抽出
                if (html.includes('勝利')) state.lastResult = 'WIN';
                else if (html.includes('敗北')) state.lastResult = 'LOSE';
                else state.lastResult = 'UNKNOWN';

                // セッション保存
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

            /******************************************************
             * 入院検知
             ******************************************************/
            if (html.includes('<blink>入院中</blink>')) {
                if (state.phase === 'IDLE') {
                    state.phase = 'REPAIR';
                    logAction('入院検知：回復シーケンスを開始します。');
                    if (window.runHealSequence) window.runHealSequence();
                }
            }

            /******************************************************
             * ST/SP 検知
             ******************************************************/
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

    /******************************************************
     * 疑似遷移（iframe内だけ）
     ******************************************************/
    async function silentNavigate(url) {
        const resp = await fetch(url);
        const html = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        document.body.innerHTML = doc.body.innerHTML;
        return doc;
    }

    /******************************************************
     * 修理 → HP回復
     ******************************************************/
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

    /******************************************************
     * HP回復工程（残数送信付き）
     ******************************************************/
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

    /******************************************************
     * ST/SP回復（iframe内完結）
     ******************************************************/
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

    /******************************************************
     * iframe初期化：抗争ページならロギングON
     ******************************************************/
    (function init() {
        if (location.href.includes('/war/member-list/')) {
            state.loggingActive = true;
            state.isWarActive = true;
            logAction('突撃成功 → ロギング開始');
        }
    })();
})();