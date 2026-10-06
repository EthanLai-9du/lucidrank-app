"""v0.1.1 checks: custom title bar, no click focus outlines, toned-down borders. Serve src/ on :8765 first."""
import pathlib
from playwright.sync_api import sync_playwright
import os
BASE=os.environ.get("LR_BASE","http://127.0.0.1:8765/"); OUT=pathlib.Path(__file__).resolve().parent.parent/"shots"; errors=[]
def pg(ctx):
    p=ctx.new_page(); p.on("pageerror",lambda e:errors.append(str(e)))
    p.on("console",lambda m:errors.append(m.text) if m.type=="error" else None); return p
with sync_playwright() as pw:
    b=pw.chromium.launch()
    for lang in ["tc","sc"]:
        ctx=b.new_context(viewport={"width":1080,"height":740},locale="zh-HK" if lang=="tc" else "zh-CN")
        ctx.add_init_script("localStorage.setItem('lr-lang','%s')"%lang)
        p=pg(ctx); p.goto(BASE+"index.html"); p.wait_for_timeout(500)
        p.click("[data-view=matches]"); p.click("[data-view=today]"); p.wait_for_timeout(400)
        out=p.evaluate("getComputedStyle(document.querySelector('[data-view=today]')).outlineStyle")
        assert out=="none", "click left an outline: "+out
        p.hover(".wc-close"); p.wait_for_timeout(250)
        p.screenshot(path=str(OUT/f"v011-{lang}-main-today.png"))
        if lang=="tc":
            # keyboard users still get a focus ring
            p.mouse.move(600,400); p.keyboard.press("Tab"); p.keyboard.press("Tab"); p.wait_for_timeout(200)
            assert p.evaluate("document.documentElement.classList.contains('kbd')")
            p.screenshot(path=str(OUT/"v011-tc-keyboard-focus.png"))
            p.evaluate("async()=>{ await LR.store.update(d=>LRStats.sampleData(d)); }"); p.reload(); p.wait_for_timeout(400)
            p.click("[data-view=insights]"); p.wait_for_timeout(500); p.screenshot(path=str(OUT/"v011-tc-insights.png"))
            p.click("[data-view=settings]"); p.wait_for_timeout(300); p.screenshot(path=str(OUT/"v011-tc-settings.png"))
            assert p.locator(".tbar [data-tauri-drag-region]").count()>=0 and p.evaluate("document.querySelector('.tbar').hasAttribute('data-tauri-drag-region')")
            assert p.evaluate("!document.querySelector('.wc-close').hasAttribute('data-tauri-drag-region')")
            c=pg(ctx); c.set_viewport_size({"width":440,"height":680}); c.goto(BASE+"checkin.html?game=val"); c.wait_for_timeout(1200)
            c.screenshot(path=str(OUT/"v011-tc-checkin.png"))
            for k in ["4","3","2","1","2","1"]: c.keyboard.press(k); c.wait_for_timeout(380)
            c.screenshot(path=str(OUT/"v011-tc-checkin-multi.png"))
            c.keyboard.press("Enter"); c.wait_for_timeout(380); c.keyboard.press("2"); c.wait_for_timeout(380); c.keyboard.press("4"); c.wait_for_timeout(1600)
            c.screenshot(path=str(OUT/"v011-tc-checkin-done.png"))
            # in-window fallback (same component as the pop-up)
            p.click("[data-view=today]"); p.wait_for_timeout(300)
            p.evaluate("async()=>{ await LR.store.update(d=>{ delete d.checkins[LR.dayKey()]; }); }"); p.reload(); p.wait_for_timeout(500)
            p.click("[data-act=checkinHere]"); p.wait_for_timeout(900)
            p.screenshot(path=str(OUT/"v011-tc-fallback-checkin.png"))
            for k in ["4","3","2","1","2","1"]: p.keyboard.press(k); p.wait_for_timeout(380)
            p.keyboard.press("Enter"); p.wait_for_timeout(380); p.keyboard.press("2"); p.wait_for_timeout(380); p.keyboard.press("4"); p.wait_for_timeout(1500)
            p.screenshot(path=str(OUT/"v011-tc-fallback-done.png"))
            p.wait_for_timeout(3600)
            assert p.locator("#v-today.on .ci-card.done").count()==1, "inline check-in did not return to Today"
            p.evaluate("LRMain.showInline('lineups',true)"); p.wait_for_timeout(700)
            p.screenshot(path=str(OUT/"v011-tc-fallback-lineups.png"))
            p.click("[data-back]"); p.wait_for_timeout(300)
            assert p.locator("#v-inline.on").count()==0
            l=pg(ctx); l.set_viewport_size({"width":1120,"height":760}); l.goto(BASE+"lineups.html?game=cs2"); l.wait_for_timeout(500)
            l.click("[data-map=Inferno]"); l.wait_for_timeout(300); l.hover(".wc-max"); l.wait_for_timeout(200)
            l.screenshot(path=str(OUT/"v011-tc-lineups.png"))
        ctx.close()
    b.close()
print("\n".join(errors) or "no console errors")
