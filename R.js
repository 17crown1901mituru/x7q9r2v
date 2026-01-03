const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
    // デバイス環境設定
    const chromePath = '/data/data/com.termux/files/usr/bin/chromium-browser';
    const loginUrl = 'https://tantora.jp/nologin/login/try?login_id=???&password=!!!';
    const userAgent = 'Mozilla/5.0 (Linux; Android 14; SO-53D) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36';

    let nextWarTime = null; 
    let lastStatus = ""; // 同じログの連投を防ぐフラグ

    // イベントログ出力用関数
    const logEvent = (msg) => {
        if (lastStatus === msg) return;
        console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
        lastStatus = msg;
    };

    // 監視エンジン注入関数
    const activateMonitoring = async (targetPage) => {
        try {
            const uiExists = await targetPage.evaluate(() => !!document.getElementById('tmx-ui-container'));
            if (uiExists) return;

            logEvent("--- 監視エンジン注入開始 ---");
            const logic = fs.readFileSync(path.join(__dirname, '入院判定修理回復遅延tmx.js'), 'utf8');
            const ui = fs.readFileSync(path.join(__dirname, 'UI表示tmx.js'), 'utf8');

            await targetPage.evaluate(logic);
            await targetPage.evaluate(ui);
            logEvent("--- 注入成功：UIとロジックを起動しました ---");
        } catch (e) { 
            logEvent(`注入失敗: ${e.message}`); 
        }
    };

    const checkAndAct = async () => {
        const now = new Date();
        const currentMin = now.getHours() * 60 + now.getMinutes();

        // 15分/1分に一度ブラウザを一時的に起動して状況確認
        const browser = await puppeteer.launch({ 
            executablePath: chromePath, 
            args: ['--no-sandbox', '--disable-gpu', '--single-process', '--user-agent=' + userAgent] 
        });
        const page = await browser.newPage();
        await page.setUserAgent(userAgent);
        await page.setViewport({ width: 412, height: 960, isMobile: true, hasTouch: true, deviceScaleFactor: 3.5 });

        try {
            await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

            // 1. 解析フェーズ (未解析または抗争終了後35分経過時)
            if (nextWarTime === null || currentMin > (nextWarTime + 35)) {
                const info = await page.evaluate(() => {
                    const target = Array.from(document.querySelectorAll('a')).find(a => a.innerText.includes('抗争勃発!!'));
                    if (!target) return null;
                    const tMatch = target.innerText.match(/(\d{1,2})時(\d{1,2})分/);
                    return tMatch ? parseInt(tMatch[1]) * 60 + parseInt(tMatch[2]) : null;
                });

                if (info) {
                    nextWarTime = info;
                    logEvent(`【解析成功】次戦: ${Math.floor(info/60)}:${String(info%60).padStart(2, '0')}`);
                }
                // マッチングしていない時は何も表示せずブラウザを閉じる
            } 

            // 2. 出撃判定（5分前〜開戦中）
            else if (currentMin >= (nextWarTime - 5) && currentMin <= (nextWarTime + 30)) {
                const warBtnExists = await page.evaluate(() => !!document.querySelector('img[src*="war.jpg"]'));

                if (warBtnExists) {
                    if (!page.url().includes('/war')) {
                        logEvent("war.jpg検知：戦場へ突入します");
                        await page.goto('https://tantora.jp/war').catch(() => {});
                    }
                    await activateMonitoring(page);
                }

                // リザルト検知
                const isResult = await page.evaluate(() => {
                    return document.querySelector('img[src*="index_war_result.png"]') && 
                           (document.body.innerText.includes('勝利') || document.body.innerText.includes('敗北'));
                });

                if (isResult) {
                    logEvent("--- 抗争終了を検知しました ---");
                    nextWarTime = null; // 次の解析へ
                }
            }
        } catch (e) {
            if (page.url().includes('nologin')) {
                logEvent("【警告】ログインが解除されました。再ログインを待機します。");
            } else {
                logEvent(`エラー発生: ${e.message}`);
            }
        } finally {
            await browser.close();
        }
    };

    // メインループ
    const loop = async () => {
        await checkAndAct();
        const now = new Date();
        const currentMin = now.getHours() * 60 + now.getMinutes();

        // 状態に応じて確認頻度を変える
        let interval = 60000; // 基本1分
        if (nextWarTime === null) interval = 900000; // マッチング待ちは15分に一度
        if (nextWarTime && currentMin >= (nextWarTime - 6)) interval = 10000; // 直前・戦闘中は10秒に一度

        setTimeout(loop, interval);
    };

    loop();
    console.log("-----------------------------------------");
    console.log(" 単車の虎 自動出撃システム：待機開始");
    console.log(" ※マッチング確定や開戦時のみログが表示されます");
    console.log("-----------------------------------------");
})();
