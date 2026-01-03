const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

(async () => {
    const chromePath = '/data/data/com.termux/files/usr/bin/chromium-browser';
    // クローン後に sed コマンド等で書き換えるプレースホルダー
    const loginUrl = 'https://tantora.jp/nologin/login/try?login_id=???&password=!!!';
    const userAgent = 'Mozilla/5.0 (Linux; Android 14; SO-53D) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36';
    
    let nextWarTime = null; 
    let lastStatus = "";

    const logEvent = (msg) => {
        if (lastStatus === msg) return;
        console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
        lastStatus = msg;
    };

    const activateMonitoring = async (targetPage) => {
        try {
            const uiExists = await targetPage.evaluate(() => !!document.getElementById('tmx-ui-container'));
            if (uiExists) return;

            logEvent("--- S1 注入開始 ---");

            const logic = fs.readFileSync(path.join(__dirname, 'C.js'), 'utf8');
            const ui = fs.readFileSync(path.join(__dirname, 'U.js'), 'utf8');
            
            await targetPage.evaluate(logic);
            await targetPage.evaluate(ui);
            logEvent("--- S1 成功 ---");
        } catch (e) { 
            logEvent(`S1 エラー: ${e.message}`); 
        }
    };

    const checkAndAct = async () => {
        const now = new Date();
        const currentMin = now.getHours() * 60 + now.getMinutes();
        const browser = await puppeteer.launch({ 
            executablePath: chromePath, 
            args: ['--no-sandbox', '--disable-gpu', '--single-process', '--user-agent=' + userAgent] 
        });
        const page = await browser.newPage();
        await page.setUserAgent(userAgent);
        
        try {
            await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });

            if (nextWarTime === null || currentMin > (nextWarTime + 35)) {
                const info = await page.evaluate(() => {
                    const target = Array.from(document.querySelectorAll('a')).find(a => a.innerText.includes('抗争勃発!!'));
                    if (!target) return null;
                    const tMatch = target.innerText.match(/(\d{1,2})時(\d{1,2})分/);
                    return tMatch ? parseInt(tMatch[1]) * 60 + parseInt(tMatch[2]) : null;
                });

                if (info) {
                    nextWarTime = info;
                    logEvent(`P1 確定: ${Math.floor(info/60)}:${String(info%60).padStart(2, '0')}`);
                }
            } 
            else if (currentMin >= (nextWarTime - 5) && currentMin <= (nextWarTime + 30)) {
                const warBtnExists = await page.evaluate(() => !!document.querySelector('img[src*="war.jpg"]'));
                
                if (warBtnExists) {
                    if (!page.url().includes('/war')) {
                        logEvent("W1 遷移");
                        await page.goto('https://tantora.jp/war').catch(() => {});
                    }
                    await activateMonitoring(page);
                }

                const isResult = await page.evaluate(() => {
                    return document.querySelector('img[src*="index_war_result.png"]') && 
                           (document.body.innerText.includes('勝利') || document.body.innerText.includes('敗北'));
                });

                if (isResult) {
                    logEvent("--- E1 終了 ---");
                    nextWarTime = null;
                }
            }
        } catch (e) {
            if (page.url().includes('nologin')) logEvent("--- L1 オフライン ---");
        } finally {
            await browser.close();
        }
    };

    const loop = async () => {
        await checkAndAct();
        const now = new Date();
        const currentMin = now.getHours() * 60 + now.getMinutes();
        let interval = (nextWarTime === null) ? 900000 : 60000;
        if (nextWarTime && currentMin >= (nextWarTime - 6)) interval = 10000;
        setTimeout(loop, interval);
    };

    loop();
    console.log("System initialized.");
})();
