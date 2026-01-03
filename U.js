/**
 * UI表示.js
 * タップ透過を排除し、Itemアコーディオンを下方向に展開する右側固定UI
 */
async function injectTermuxUI(page) {
    await page.evaluate(() => {
        if (document.getElementById('tmx-sync-root')) return;

        // --- メインコンテナ ---
        const container = document.createElement('div');
        container.id = 'tmx-sync-root';
        // 右側余白に配置。タップを遮らないよう全体の pointer-events 設定は行わない（デフォルト）
        container.style = 'position:fixed; top:10px; right:2px; z-index:2147483647; width:52px; display:flex; flex-direction:column; gap:4px;';
        
        const createBtn = (id, label, color) => {
            const b = document.createElement('div');
            if (id) b.id = id;
            // 確実にタップを検知するよう構成
            b.style = `width:100%; padding:8px 2px; background:rgba(0,0,0,0.9); border:1px solid ${color}; color:${color}; font-size:10px; text-align:center; cursor:pointer; font-weight:bold; word-break:break-all; line-height:1.1; border-radius:3px; box-sizing:border-box;`;
            b.innerHTML = label;
            return b;
        };

        // 1. リペアON/OFF
        const repairBtn = createBtn('tmx-repair-btn', 'Repair<br>OFF', '#5bc0de');
        window.tmxRepairOn = false;
        repairBtn.onclick = () => {
            window.tmxRepairOn = !window.tmxRepairOn;
            repairBtn.innerHTML = window.tmxRepairOn ? 'Repair<br>ON' : 'Repair<br>OFF';
            repairBtn.style.color = repairBtn.style.borderColor = window.tmxRepairOn ? '#5bc0de' : '#666';
        };

        // 2. モード切り替え (A/B/N)
        const modeBtn = createBtn('tmx-mode-btn', 'Mode<br>A', '#ff0');
        window.tmxMode = '1';
        modeBtn.onclick = () => {
            const modes = { '1': { n: 'B', c: '#f00', v: '2' }, '2': { n: 'N', c: '#fff', v: '0' }, '0': { n: 'A', c: '#ff0', v: '1' } };
            const m = modes[window.tmxMode];
            window.tmxMode = m.v;
            modeBtn.innerHTML = `Mode<br>${m.n}`;
            modeBtn.style.color = modeBtn.style.borderColor = m.c;
            fetch(`//127.0.0.1:8080/set?mode=${window.tmxMode}`).catch(()=>{});
        };

        // 3. Delay設定
        const dBtn = createBtn('tmx-delay-btn', 'Delay<br>OFF', '#ff0');
        window.tmxDelay = 0;
        const ds = [0, 500, 1000, 1500, 2000];
        let di = 0;
        dBtn.onclick = () => {
            di = (di + 1) % ds.length;
            window.tmxDelay = ds[di];
            dBtn.innerHTML = window.tmxDelay === 0 ? 'Delay<br>OFF' : `D:<br>${window.tmxDelay}ms`;
        };

        // 4. 奥義スイッチ
        const spBtn = createBtn('tmx-sp-btn', '奥義<br>OFF', '#fff');
        window.isSpOn = false;
        spBtn.onclick = () => {
            window.isSpOn = !window.isSpOn;
            spBtn.innerHTML = window.isSpOn ? '奥義<br>ON' : '奥義<br>OFF';
            spBtn.style.color = spBtn.style.borderColor = window.isSpOn ? '#d9534f' : '#fff';
        };

        // 5. 奥義セットID
        const idInp = document.createElement('input');
        idInp.id = 'tmx-sp-id';
        idInp.type = 'number';
        idInp.value = '6';
        idInp.style = 'width:100%; background:#000; color:#fff; border:1px solid #d9534f; text-align:center; font-size:11px; border-radius:2px; padding:2px 0; box-sizing:border-box;';

        // 6. Itemボタン (インジケーター兼用)
        const accBtn = createBtn('tmx-item-btn', '<div id="tx-name" style="font-size:8px;">---</div><div id="tx-limit" style="color:#ff0;">--</div>', '#ccc');
        
        // 7. アイテムリスト (Itemボタンの直下に垂直展開)
        const lst = document.createElement('div');
        lst.id = 'tmx-item-list';
        lst.style = 'width:100%; max-height:250px; overflow-y:auto; display:none; background:rgba(0,0,0,0.95); border:1px solid #444; border-radius:3px; flex-shrink:0; box-sizing:border-box;';
        
        accBtn.onclick = (e) => {
            e.stopPropagation();
            lst.style.display = lst.style.display === 'none' ? 'block' : 'none';
        };

        // 各要素を順に積み上げ
        [repairBtn, modeBtn, dBtn, spBtn, idInp, accBtn, lst].forEach(el => container.appendChild(el));
        document.body.appendChild(container);

        // --- ステータス同期 ---
        setInterval(async () => {
            try {
                const r = await fetch('//127.0.0.1:8080/status');
                const j = await r.json();
                document.getElementById('tx-name').innerText = j.itemName || 'Item';
                document.getElementById('tx-limit').innerText = j.itemLimit || '--';
                
                if (j.allItemDetails && lst.style.display === 'block') {
                    lst.innerHTML = '';
                    Object.entries(j.allItemDetails).forEach(([id, n]) => {
                        const row = document.createElement('div');
                        row.style = 'padding:6px 2px; border-bottom:1px solid #222; color:#eee; font-size:9px; cursor:pointer; line-height:1.2; text-align:center;';
                        row.innerHTML = `<div>${n.name}</div><div style="font-size:8px;color:#0f0;">${n.count}/${n.limit}</div>`;
                        row.onclick = (e) => {
                            e.stopPropagation();
                            fetch(`//127.0.0.1:8080/set?id=${id}&name=${encodeURIComponent(n.name)}&limit=${encodeURIComponent(n.limit)}`);
                            lst.style.display = 'none';
                        };
                        lst.appendChild(row);
                    });
                }
            } catch (e) {}
        }, 1000);
    });
}
