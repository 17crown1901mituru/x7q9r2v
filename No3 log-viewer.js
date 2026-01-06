/******************************************************
 * Part 3：別タブログビューア（保存ボタン付き）
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
            <html>
            <head>
                <title>SneakyJS Logs</title>
                <style>
                    body {
                        background:#111;
                        color:#eee;
                        font-family:monospace;
                        padding:20px;
                    }
                    select, button {
                        font-size:16px;
                        padding:4px;
                        margin-right:6px;
                    }
                    pre {
                        background:#000;
                        padding:10px;
                        border:1px solid #444;
                        white-space:pre-wrap;
                        word-break:break-all;
                        max-height:300px;
                        overflow-y:auto;
                    }
                </style>
            </head>
            <body>

                <h1 style="color:#0f0;">ログセッション選択</h1>

                <select id="sessionSelect">
                    ${keys.map(k => `<option value="${k}" ${k===latestKey?'selected':''}>${k}</option>`).join('')}
                </select>

                <button id="deleteSession">このセッションを削除</button>
                <button id="saveFront">Front保存</button>
                <button id="saveAction">Action保存</button>
                <button id="saveTraffic">Traffic保存</button>

                <h2 style="color:#d4b106;">Front Logs</h2>
                <pre id="front"></pre>

                <h2 style="color:#52c41a;">Action Logs</h2>
                <pre id="action"></pre>

                <h2 style="color:#1890ff;">Traffic Logs</h2>
                <pre id="traffic"></pre>

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
                        saveText('front_' + select.value + '.txt', frontPre.textContent);
                    };
                    document.getElementById('saveAction').onclick = () => {
                        saveText('action_' + select.value + '.txt', actionPre.textContent);
                    };
                    document.getElementById('saveTraffic').onclick = () => {
                        saveText('traffic_' + select.value + '.txt', trafficPre.textContent);
                    };

                    const latestKey = "${latestKey}";

                    // ★ リアルタイム追記（最新セッションのみ）
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

            </body>
            </html>
        `);

        win.document.close();
        window.state.logWindow = win;
    };

})();

/******************************************************
 * ▼▼▼ BE（Back Engine：回復・修理・ST/SP・終了判定）ここに backEngine.js を貼る ▼▼▼
 ******************************************************/

// --- backEngine.js をここに貼り付ける ---



/******************************************************
 * ▼▼▼ SM（Session Manager：セッション保存・最大4件管理）ここに sessionManager.js を貼る ▼▼▼
 ******************************************************/

// --- sessionManager.js をここに貼り付ける ---



/******************************************************
 * ▼▼▼ LV（Log Viewer：別タブログビュー）ここに logViewer.js を貼る ▼▼▼
 ******************************************************/

// --- logViewer.js をここに貼り付ける ---
