/******************************************************
 * Part 5-1：裏エンジン（fetch フック・終了判定・ログ送信）
 ******************************************************/
(function() {
    'use strict';

    // ★ iframe 内のみ動作
    if (window === window.parent) return;

    const state = window.state;

    /******************************************************
     * ログ送信（Action）
     ******************************************************/
    function logAction(msg) {
        const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
        state.logs.action.push(line);
        parent.postMessage({ type: 'LOG_ACTION', text: line }, '*');
        state.saveLogs();
    }

    /******************************************************
     * ログ送信（Traffic）
     ******************************************************/
    function logTraffic(msg) {
        const line = `[RECV ${new Date().toLocaleTimeString()}] ${msg}`;
        state.logs.traffic.push(line);
        parent.postMessage({ type: 'LOG_TRAFFIC', text: line }, '*');
        state.saveLogs();
    }

    /******************************************************
     * 親から設定を受信
     ******************************************************/
    window.addEventListener('message', (ev) => {
        if (!ev.data || ev.data.type !== 'WAR_CONFIG') return;
        const cfg = ev.data.payload || {};

        if (cfg.repairEnabled !== undefined) state.repairEnabled = cfg.repairEnabled;
        if (cfg.equipMode     !== undefined) state.equipMode     = cfg.equipMode;
        if (cfg.targetHpName  !== undefined) state.targetHpName  = cfg.targetHpName;
        if (cfg.delayMs       !== undefined) state.delayMs       = cfg.delayMs;
    });

    /******************************************************
     * fetch フック（抗争終了判定・入院検知・ST/SP）
     ******************************************************/
    const baseFetch = window.fetch;

    window.fetch = async function(...args) {
        const req = args[0];
        const url = typeof req === 'string' ? req : req.url;

        // ★ 遅延（Delay）
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
             * ★ 抗争終了判定（3条件のうち2つ以上）
             ******************************************************/
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

            /******************************************************
             * ★ 入院検知 → 回復シーケンスへ
             ******************************************************/
            if (html.includes('<blink>入院中</blink>')) {
                if (state.phase === 'IDLE') {
                    state.phase = 'REPAIR';
                    logAction('入院検知：回復シーケンスを開始します。');
                    if (window.runHealSequence) window.runHealSequence();
                }
            }

            /******************************************************
             * ★ ST/SP 回復
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
     * silentNavigate（裏でページ遷移）
     ******************************************************/
    async function silentNavigate(url) {
        const resp = await fetch(url);
        const html = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        document.body.innerHTML = doc.body.innerHTML;
        return doc;
    }

    // ★ 他パートで使うので公開
    window.silentNavigate = silentNavigate;

})();
