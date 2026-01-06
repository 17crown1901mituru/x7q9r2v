/******************************************************
 * 別タブログビュー（セッション選択＋削除）
 ******************************************************/
(function() {
    window.openLogViewer = function() {
        const win = window.open('', '_blank');
        if (!win) return;

        const sessions = JSON.parse(localStorage.getItem('tmx_sessions') || '{}');
        const keys = Object.keys(sessions).sort();
        const latestKey = keys[keys.length - 1];

        win.document.write(`
            <html><head><title>SneakyJS Logs</title></head>
            <body style="background:#111;color:#eee;font-family:monospace;padding:20px;">

                <h1 style="color:#0f0;">ログセッション選択</h1>
                <select id="sessionSelect" style="font-size:16px;padding:4px;">
                    ${keys.map(k => `<option value="${k}" ${k===latestKey?'selected':''}>${k}</option>`).join('')}
                </select>
                <button id="deleteSession">このセッションを削除</button>

                <h2 style="color:#d4b106;">Front Logs</h2>
                <pre id="front" style="background:#000;padding:10px;border:1px solid #444;"></pre>

                <h2 style="color:#52c41a;">Action Logs</h2>
                <pre id="action" style="background:#000;padding:10px;border:1px solid #444;"></pre>

                <h2 style="color:#1890ff;">Traffic Logs</h2>
                <pre id="traffic" style="background:#000;padding:10px;border:1px solid #444;"></pre>

                <script>
                    const sessions = ${JSON.stringify(sessions)};
                    const select = document.getElementById('sessionSelect');

                    function loadSession(key) {
                        const s = sessions[key];
                        document.getElementById('front').textContent   = (s.front   || []).join('\\n');
                        document.getElementById('action').textContent  = (s.action  || []).join('\\n');
                        document.getElementById('traffic').textContent = (s.traffic || []).join('\\n');
                    }

                    loadSession(select.value);

                    select.onchange = () => loadSession(select.value);

                    document.getElementById('deleteSession').onclick = () => {
                        const key = select.value;
                        delete sessions[key];
                        localStorage.setItem('tmx_sessions', JSON.stringify(sessions));
                        location.reload();
                    };

                    const latestKey = "${latestKey}";
                    window.addEventListener('message', (ev) => {
                        if (select.value !== latestKey) return;
                        if (!ev.data || !ev.data.type || !ev.data.text) return;

                        if (ev.data.type === 'LOG_FRONT') {
                            document.getElementById('front').textContent += '\\n' + ev.data.text;
                        }
                        if (ev.data.type === 'LOG_ACTION') {
                            document.getElementById('action').textContent += '\\n' + ev.data.text;
                        }
                        if (ev.data.type === 'LOG_TRAFFIC') {
                            document.getElementById('traffic').textContent += '\\n' + ev.data.text;
                        }
                    });
                </script>

            </body></html>
        `);

        win.document.close();
    };
})();