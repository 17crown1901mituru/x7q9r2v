javascript:(function(){
    const p = window.opener;
    if(!p || !p.remoteState) return;
    [span_1](start_span)const full = ["濃縮スッポンエキス", "闇鍋", "フォアグラ"];[span_1](end_span)
    [span_2](start_span)let s = JSON.parse(localStorage.getItem('tiger_log') || '{"win":0,"lose":0,"logs":[]}');[span_2](end_span)
    [span_3](start_span)document.body.innerHTML = '<div id="log" style="background:#000;color:#0f0;padding:10px;height:100vh;overflow-y:auto;font-family:monospace;font-size:12px;line-height:1.2;"></div>';[span_3](end_span)
    [span_4](start_span)const l = document.getElementById('log');[span_4](end_span)
    const logger = (m, t) => {
        const r = document.createElement('div');
        r.style.color = {win:'#ff0', lose:'#f00', sys:'#fff'}[t] || '#0f0';
        r.innerText = `[${new Date().toLocaleTimeString()}] ${m}`;
        l.insertBefore(r, l.firstChild);
        s.logs.unshift(r.innerText);
        if(s.logs.length > 100) s.logs.pop();
        localStorage.setItem('tiger_log', JSON.stringify(s));
        document.title = m.substring(0, 15);
    [span_5](start_span)};[span_5](end_span)
    let ir = false, le = "";
    setInterval(() => {
        try {
            [span_6](start_span)const f = Array.from(p.document.querySelectorAll('iframe')).find(i => i.offsetWidth > 200);[span_6](end_span)
            if(!f) return;
            [span_7](start_span)const fd = f.contentDocument || f.contentWindow.document;[span_7](end_span)
            [span_8](start_span)const en = fd.querySelector('.nickName') || fd.querySelector('#enemy_name');[span_8](end_span)
            const ce = en ? en.innerText.trim() : "";
            if(ce && ce !== le) {
                le = ce;
                logger(`対戦:${ce}`, 'sys');
            }
            const txt = fd.body.innerText;
            if(txt.includes("WIN")) {
                s.win++; logger(`勝利 vs ${le}`, 'win'); le = "";
            } else if(txt.includes("LOSE")) {
                s.lose++; logger(`敗北 vs ${le}`, 'lose'); le = "";
            }
            [span_9](start_span)const h = txt.includes("入院中") || fd.querySelector('blink');[span_9](end_span)
            if(h && !ir && p.remoteState.repair) {
                ir = true;
                [span_10](start_span)let rf = fd.getElementById('r-g');[span_10](end_span)
                if(!rf) {
                    rf = fd.createElement('iframe');
                    rf.id = 'r-g';
                    [span_11](start_span)rf.style.cssText = 'width:1px;height:1px;position:absolute;left:-100px';[span_11](end_span)
                    fd.documentElement.appendChild(rf);
                }
                [span_12](start_span)rf.src = 'https://tantora.jp/item/repair-confirm';[span_12](end_span)
                rf.onload = () => {
                    try {
                        [span_13](start_span)const b = (rf.contentDocument || rf.contentWindow.document).getElementById('submit_repair');[span_13](end_span)
                        if(b && !b.disabled) {
                            b.click();
                            [span_14](start_span)logger("修理実行", "sys");[span_14](end_span)
                        }
                    } catch(e) {}
                    setTimeout(() => {
                        ir = false;
                        if(p.remoteState.reserved) {
                            [span_15](start_span)const its = Array.from(fd.querySelectorAll('#accordionBody .itemList li'));[span_15](end_span)
                            [span_16](start_span)const t = its.find(li => li.innerText.includes(p.remoteState.reserved));[span_16](end_span)
                            if(t) {
                                t.click();
                                [span_17](start_span)logger(`予約:${p.remoteState.reserved}`, 'sys');[span_17](end_span)
                                const c = setInterval(() => {
                                    [span_18](start_span)const r = fd.querySelector(`input[name="select_preset_radio"][value="${p.remoteState.mode}"]`);[span_18](end_span)
                                    [span_19](start_span)const isF = full.some(n => p.remoteState.reserved.includes(n));[span_19](end_span)
                                    [span_20](start_span)let ok = isF ? fd.querySelector('.basic_dialog_OK') : (fd.querySelector('.button_dialog_short a') || fd.querySelector('.basic_dialog_OK'));[span_20](end_span)
                                    if(r && ok) {
                                        r.checked = true;
                                        ok.click();
                                        clearInterval(c);
                                        p.remoteState.reserved = null;
                                        [span_21](start_span)logger("復帰完了", "win");[span_21](end_span)
                                    }
                                }, 30);
                                setTimeout(() => clearInterval(c), 2000);
                            }
                          } else if(!p.document.getElementById('wp')) {
                            [span_22](start_span)const ns = Array.from(fd.querySelectorAll('#accordionBody .itemList li p')).map(e => e.innerText.split('(')[0].trim());[span_22](end_span)
                            [span_23](start_span)p.showWiper(ns);[span_23](end_span)
                        }
                    }, 2500);
                };
            }
        } catch(e) {}
    }, 400);
})();