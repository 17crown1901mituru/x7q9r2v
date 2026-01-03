/**
 * 入院判定・リペア.js
 * 役割: 通信制御、入院リカバリー、規定値即時回復
 * 修正: ラジオボタンonclick対応、HP種限定同期
 */

(async () => {
    // --- 1. 通信介入設定 ---
    await page.setRequestInterception(true);

    page.on('request', async (req) => {
        const url = req.url();
        if (url.includes('war/battle?other_id=')) {
            // ディレイ制御
            const delay = await page.evaluate(() => window.tmxDelay || 0);
            if (delay > 0) await new Promise(r => setTimeout(r, delay));
            
            // 入院中の攻撃ブロック
            const isAdmitted = await page.evaluate(() => window.tmxAdmitted);
            if (isAdmitted) return req.abort();
        }
        req.continue();
    });

    page.on('response', async (res) => {
        const url = res.url();
        if (!url.includes('war/')) return;
        const text = await res.text();

        // UI設定の取得
        const config = await page.evaluate(() => ({
            enabled: window.tmxRepairOn,
            mode: window.tmxMode,           // '1'(A), '2'(B), '0'(N)
            itemId: window.tmxSelectedId,
            isFull: window.tmxIsFullHeal,
            itemType: window.tmxSelectedItemType, 
            h: window.currentHash
        }));

        if (!config.enabled || !config.itemId) return;

        // --- 2. HPリカバリー (入院時: 修理＋着替え＋回復) ---
        if (text.includes('入院中')) {
            await page.evaluate(() => { window.tmxAdmitted = true; });
            
            // 修理実行
            await page.goto('https://tantora.jp/item/repair-confirm');
            await page.evaluate(() => {
                const b = document.querySelector("a[onclick*='submit']");
                if (b) b.click();
            });

            // 抗争復帰シーケンス
            await page.goto('https://tantora.jp/war/index');
            await page.evaluate((it) => {
                // HP回復時のみラジオボタンのonclickを発火
                const modeVal = it.mode === '1' ? 'A' : (it.mode === '2' ? 'B' : 'none');
                const rb = document.querySelector(`input[name="set_id"][value="${modeVal}"]`) || document.querySelector(`#img_${modeVal}`);
                if (rb) rb.click(); // onclick属性を実行

                // 回復実行
                if (it.isFull) {
                    document.querySelector(`li[onclick*='${it.itemId}']`)?.click();
                } else {
                    const form = document.querySelector(`#itemUseMultiForm${it.itemId}`);
                    if (form) form.submit();
                }
            }, config);
            return;
        }

        // --- 3. ST/SPリカバリー (生存中: 規定値で即回復・着替えなし) ---
        const status = await page.evaluate(() => {
            const getVal = (id) => {
                const el = document.getElementById(id);
                return el ? parseInt(el.innerText.replace(/[^0-9]/g, '')) : null;
            };
            return { st: getVal('st_gauge_value'), sp: getVal('sp_gauge_value') };
        });

        const needSt = (status.st === 0 && config.itemType === 'ST');
        const needSp = (status.sp !== null && status.sp <= 400 && config.itemType === 'SP');

        if (needSt || needSp) {
            await page.goto('https://tantora.jp/war/index');
            await page.evaluate((it) => {
                // 着替えなしで直接アイテム使用
                if (it.isFull) {
                    document.querySelector(`li[onclick*='${it.itemId}']`)?.click();
                } else {
                    const form = document.querySelector(`#itemUseMultiForm${it.itemId}`);
                    if (form) form.submit();
                }
            }, config);
            return;
        }

        // 入院表示がなければブロック解除
        if (!text.includes('入院中')) {
            await page.evaluate(() => { window.tmxAdmitted = false; });
        }

        // --- 4. アイテムリスト同期 (HP種を含むアイテムのみ) ---
        if (text.includes('class="itemHP"')) {
            await page.evaluate((htmlText) => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, 'text/html');
                const hpItems = {};
                
                // itemHPクラスを持つ要素のみに限定
                doc.querySelectorAll('li.itemHP').forEach(li => {
                    const oc = li.getAttribute('onclick') || "";
                    const idMatch = oc.match(/item_status_one(\d+)/);
                    if (!idMatch) return;
                    
                    const id = idMatch[1];
                    hpItems[id] = {
                        name: li.querySelector('p:first-child')?.innerText.trim(),
                        count: li.querySelector('p:nth-child(2)')?.innerText.replace(/[^0-9]/g, ''),
                        limit: li.querySelector('p:last-child')?.innerText.replace('残り', '').replace('回', '').trim(),
                        isFull: li.innerHTML.includes('全回復'),
                        type: 'HP'
                    };
                });
                window.allItemDetails = hpItems; // UIに反映
            }, text);
        }
    });
})();

