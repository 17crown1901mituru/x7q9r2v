javascript: (function() {
  const e = () => {
    try {
      const e = document.createElement("video");
      e.loop = !0, e.muted = !0, e.playsinline = !0, e.style.display = "none",
        e.src = "data:video/mp4;base64,AAAAHGZ0eXBpc29tAAACAGlzb21hdmMxbXA0MgAAAAhmcmVlAAAAAG1kYXQ=",
        document.body.appendChild(e), e.play().catch((() => {}))
    } catch (e) {}
    setInterval((() => {
      window.dispatchEvent(new Event("scroll"))
    }), 2e4)
  };
  e();
  let t = 800,
    n = 0,
    r = !0,
    i = !1,
    o = !1;
  const a = () => {
    if (!r || i) return;
    i = !0;
    const e = document.getElementById("r-t");
    e && (e.style.color = "orange");
    let t = document.getElementById("r-g");
    t || (t = document.createElement("iframe"), t.id = "r-g",
      t.style.cssText = "width:1px;height:1px;position:absolute;left:-100px",
      document.documentElement.appendChild(t)),
      t.src = "https://tantora.jp/item/repair-confirm",
      t.onload = () => {
        try {
          const e = (t.contentDocument || t.contentWindow.document).getElementById("submit_repair");
          e && !e.disabled && e.click()
        } catch (e) {}
        setTimeout((() => {
          i = !1, e && (e.style.color = "#fff"), t && (t.src = "about:blank")
        }), 3e3)
      }
  }, c = e => {
    try {
      if (!e || !e.XMLHttpRequest || e.XMLHttpRequest._h) return;
      const r = e.XMLHttpRequest.prototype,
        i = r.open;
      r.open = function(e, t) {
        return this._u = t, i.apply(this, arguments)
      };
      const o = r.send;
      r.send = function(e) {
        const i = this._u || "";
        if (i.includes("war/battle?other_id=")) {
          if (document.body.innerText.includes("入院中")) return;
          const i = Date.now(),
            a = Math.max(0, t - (i - n));
          return void setTimeout((() => {
            n = Date.now(), o.apply(this, [e])
          }), a)
        }
        o.apply(this, [e])
      }, e.XMLHttpRequest._h = 1
    } catch (e) {}
  }, s = () => {
    if (document.getElementById("w-u")) return;
    const e = document.createElement("div");
    e.id = "w-u", e.setAttribute("style", "position:fixed!important;z-index:2147483647;top:325px;left:260px;width:45px;height:30px;background:rgba(200,0,0,0.9);color:#fff;border:1px solid #fff;border-radius:4px;font-size:13px;line-height:28px;text-align:center;font-weight:bold;backdrop-filter:blur(4px)");
    e.innerText = t, e.onclick = () => {
      t = 800 === t ? 400 : 800, e.innerText = t,
        e.style.background = 400 === t ? "rgba(0,150,0,0.9)" : "rgba(200,0,0,0.9)"
    };
    const n = document.createElement("div");
    n.id = "r-t", n.setAttribute("style", "position:fixed!important;z-index:2147483647;top:325px;left:310px;width:75px;height:30px;background:rgba(0,0,0,0.8);color:#fff;border:1px solid #fff;border-radius:4px;font-size:11px;line-height:28px;text-align:center;font-weight:bold;backdrop-filter:blur(4px)");
    n.innerText = "Repair ON", n.onclick = () => {
      r = !r, n.innerText = r ? "Repair ON" : "Repair OFF",
        n.style.background = r ? "rgba(0,0,0,0.8)" : "rgba(100,100,100,0.8)"
    }, document.documentElement.appendChild(e), document.documentElement.appendChild(n)
  };
  setInterval((() => {
    const e = document.body.innerText.includes("入院中");
    e && !o && r && a(), o = e, document.getElementById("w-u") || s(),
      document.querySelectorAll("iframe").forEach((e => {
        if ("r-g" !== e.id) try {
          c(e.contentWindow), e._h || (e.addEventListener("load", (() => c(e.contentWindow))), e._h = 1)
        } catch (e) {}
      }))
  }), 500), document.getElementById("iframe1") || (function() {
    var e = document,
      t = e.createElement("script");
    t.src = "//panchitool.xsrv.jp/special/secret/secretstart.js", e.head.appendChild(t)
  })()
})();
