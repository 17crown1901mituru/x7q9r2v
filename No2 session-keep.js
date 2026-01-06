/******************************************************
 * Part 2：セッション保存・セッション管理
 ******************************************************/
(function() {
    'use strict';

    const state = window.state;

    // 日付フォーマット
    function formatDate() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    // ★ セッション保存（抗争終了時に呼ばれる）
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

    // ★ 古いセッションを削除（最大4件）
    window.cleanupOldSessions = function() {
        let sessions = JSON.parse(localStorage.getItem('tmx_sessions') || '{}');
        const keys = Object.keys(sessions);

        if (keys.length <= 4) return;

        // 古い順にソート
        const sorted = keys.sort((a, b) => sessions[a].timestamp - sessions[b].timestamp);

        // 4件になるまで削除
        while (sorted.length > 4) {
            const oldest = sorted.shift();
            delete sessions[oldest];
        }

        localStorage.setItem('tmx_sessions', JSON.stringify(sessions));
    };

})();
            </body></html>
        `);

        win.document.close();
    };
})();
