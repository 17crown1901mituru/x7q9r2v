
javascript:void(function(){
    /* --- 1. アクティブ保持（スリープ防止） --- */
    const alive = () => {
        try {
            const v = document.createElement('video');
            v.loop = true; v.muted = true; v.playsinline = true; v.style.display = 'none';
            v.src = 'data:video/mp4;base64,AAAAHGZ0eXBpc29tAAACAGlzb21hdmMxbXA0MgAAAAhmcmVlAAAAAG1kYXQ=';
            document.body.appendChild(v);
            v.play().catch(()=>{});
        } catch(e){}
        /* 20秒ごとにスクロールイベントを擬似発火 */
        setInterval(() => { window.dispatchEvent(new Event('scroll')); }, 20000);
    };
    alive();

    /* --- 2. 変数管理 --- */
    const UI_ID = 'wait-control-ui';
    const REPAIR_UI_ID = 'repair-toggle-ui';
    let WAIT = 800;
    let last = 0;
    let autoRepair = true; /* 自動修理のON/OFF */
    let isRepairing = false; /* 二重実行防止 */
    let wasHospitalized = false; /* 入院状態の変化監視用 */

    /* --- 3. 裏側修理実行（極小iframe） --- */
    const runRepair = () => {
        if (!autoRepair || isRepairing) return;
        isRepairing = true;
        
        const rBtn = document.getElementById(REPAIR_UI_ID);
        if (rBtn) rBtn.style.color = 'orange'; /* 修理中サイン */

        let f = document.getElementById('repair-gate');
        if (!f) {
            f = document.createElement('iframe');
            f.id = 'repair-gate';
            f.style.width = '1px'; f.style.height = '1px'; f.style.position = 'absolute'; f.style.left = '-100px';
            document.documentElement.appendChild(f);
        }
        /* 修理確認画面をロード */
        f.src = 'https://tantora.jp/item/repair-confirm';

        f.onload = () => {
            try {
                const doc = f.contentDocument || f.contentWindow.document;
                const submitBtn = doc.getElementById('submit_repair');
                /* ソースに基づき id="submit_repair" を直接クリック */
                if (submitBtn && !submitBtn.disabled) {
                    submitBtn.click();
                    console.log("入院トリガーにより自動リペアを実行しました");
                }
            } catch(e) {}
            
            /* 3秒後にフラグをリセット */
            setTimeout(() => {
                isRepairing = false;
                if (rBtn) rBtn.style.color = '#fff';
                if (f) f.src = 'about:blank';
            }, 3000);
        };
    };

    /* --- 4. 通信検閲（攻撃URLのみを監視） --- */
    const hook = (w) => {
        try {
            if (!w || !w.XMLHttpRequest || w.XMLHttpRequest._h) return;
            const proto = w.XMLHttpRequest.prototype;
            const op = proto.open;
            proto.open = function(m, u) { this._u = u; return op.apply(this, arguments); };
            
            const sd = proto.send;
            proto.send = function(data) {
                const url = this._u || "";
                /* 攻撃実行URL(/war/battle?other_id=)のみに介入 */
                if (url.includes('war/battle?other_id=')) {
                    /* 親DOMに入院中表示があれば、即座に送信を握りつぶす */
                    if (document.body.innerText.includes('入院中')) {
                        console.log("入院中のため攻撃を遮断");
                        return;
                    }

                    /* 生存中は設定されたWAIT秒数だけ送信を遅延 */
                    const now = Date.now();
                    const delay = Math.max(0, WAIT - (now - last));
                    setTimeout(() => { 
                        last = Date.now(); 
                        sd.apply(this, [data]); 
                    }, delay);
                    return;
                }
                /* それ以外の通信（member-list等）はノータイムで通過 */
                sd.apply(this, [data]);
            };
            w.XMLHttpRequest._h = 1;
        } catch(e) {}
    };

    /* --- 5. UI構築（html直下固定） --- */
    const createUI = () => {
        if (document.getElementById(UI_ID)) return;
        
          /* 自動リペアON/OFFボタン */
        const rBtn = document.createElement('div');
        rBtn.id = REPAIR_UI_ID;
        rBtn.setAttribute('style', 'position:fixed!important;z-index:2147483647!important;top:542px;left:280px;width:85px;height:32px;background:rgba(0,0,0,0.8)!important;color:#fff!important;border:2px solid #fff!important;border-radius:5px!important;font-size:12px!important;line-height:28px!important;text-align:center!important;cursor:pointer!important;font-weight:bold!important;backdrop-filter:blur(4px);');
        rBtn.innerText = 'Repair ON';
        rBtn.onclick = (e) => {
            autoRepair = !autoRepair;
            rBtn.innerText = autoRepair ? 'Repair ON' : 'Repair OFF';
            rBtn.style.background = autoRepair ? 'rgba(0,0,0,0.8)' : 'rgba(100,100,100,0.8)';
        };

        document.documentElement.appendChild(btn);
        document.documentElement.appendChild(rBtn);
    };

    /* --- 6. 定期監視ループ --- */
    setInterval(() => {
        const isHosp = document.body.innerText.includes('入院中');
        
        /* 「入院した瞬間」かつ「自動修理ON」なら修理実行 */
        if (isHosp && !wasHospitalized && autoRepair) {
            runRepair();
        }
        wasHospitalized = isHosp;

        /* UIが消えていたら再生成 */
        if (!document.getElementById(UI_ID)) createUI();

        /* 全てのiframe(ツール等)に通信フックを適用 */
        document.querySelectorAll('iframe').forEach(f => {
            if (f.id === 'repair-gate') return; /* 修理用iframeは監視対象外 */
            try { 
                hook(f.contentWindow);
                if(!f._h){ 
                    f.addEventListener('load', () => hook(f.contentWindow)); 
                    f._h = 1; 
                }
            } catch(e) {}
        });
    }, 500);

    /* --- 7. オリジナルツール起動 --- */
    if(!document.getElementById("iframe1")){
        var d=document, e=d.createElement("script");
        e.charset="utf-8";
        e.src="//panchitool.xsrv.jp/special/secret/secretstart.js"+"?%22+new%20Date().getTime();
        d.getElementsByTagName("head")[0].appendChild(e);
    }
})();