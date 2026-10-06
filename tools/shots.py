"""Static-page UI test with the browser mock of the Tauri API (no Rust needed).
Serve src/ first:  python3 -m http.server 8765 --bind 127.0.0.1  (from src/)
Then:              python3 tools/shots.py   -> shots/*.png"""
import sys, pathlib
from playwright.sync_api import sync_playwright
BASE = "http://127.0.0.1:8765/"
OUT = pathlib.Path(__file__).resolve().parent.parent / "shots"
OUT.mkdir(exist_ok=True)
errors = []

def page_for(ctx, lang):
    p = ctx.new_page()
    p.on("console", lambda m: errors.append(f"[{lang}] console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    p.on("pageerror", lambda e: errors.append(f"[{lang}] pageerror: {e}"))
    return p

def run(lang, full):
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context(viewport={"width": 1080, "height": 740}, device_scale_factor=1, locale={"sc": "zh-CN", "tc": "zh-HK", "en": "en-US"}[lang])
        ctx.add_init_script("localStorage.setItem('lr-lang', %r)" % lang if lang else "")
        p = page_for(ctx, lang)
        p.goto(BASE + "index.html?game=val")
        p.wait_for_timeout(500)
        p.screenshot(path=str(OUT / f"{lang}-01-today-empty.png"))
        if full:
            # insights empty state
            p.click("[data-view=insights]"); p.wait_for_timeout(300)
            p.screenshot(path=str(OUT / f"{lang}-02-insights-empty.png"))
        # check-in window (separate page)
        c = page_for(ctx, lang)
        c.set_viewport_size({"width": 440, "height": 680})
        c.goto(BASE + "checkin.html?game=val&stay=1")
        c.wait_for_timeout(1200)
        c.screenshot(path=str(OUT / f"{lang}-03-checkin-q1.png"))
        for key in ["5", "2", "4", "2"]:   # bed after 2am, 5-6h, 30min+, walk -> follow-up appears
            c.keyboard.press(key); c.wait_for_timeout(450)
        c.screenshot(path=str(OUT / f"{lang}-04-checkin-followup.png"))
        c.keyboard.press("2"); c.wait_for_timeout(450)   # gap
        c.keyboard.press("1"); c.wait_for_timeout(450)   # meals
        c.keyboard.press("2"); c.keyboard.press("4"); c.wait_for_timeout(200)
        if full: c.screenshot(path=str(OUT / f"{lang}-05-checkin-multi.png"))
        c.keyboard.press("Enter"); c.wait_for_timeout(450)
        c.keyboard.press("2"); c.wait_for_timeout(450)   # caffeine
        c.keyboard.press("4"); c.wait_for_timeout(1600)  # mood -> done
        c.screenshot(path=str(OUT / f"{lang}-06-checkin-done.png"))
        c.close()
        # main: load sample data, then views
        p.reload(); p.wait_for_timeout(400)
        p.evaluate("""async()=>{ await LR.store.update(d=>LRStats.sampleData(d)); }""")
        p.reload(); p.wait_for_timeout(400)
        # log a game
        p.click("[data-res=W]"); p.fill("input[name=k]", "21"); p.fill("input[name=d]", "14"); p.fill("input[name=a]", "6")
        p.fill("input[name=score]", "268"); p.select_option("select[name=map]", "Ascent"); p.fill("input[name=rank]", "")
        p.click("#shotBtn"); p.wait_for_timeout(200)
        p.screenshot(path=str(OUT / f"{lang}-07-today-logform.png"))
        p.click("#logForm button[type=submit]"); p.wait_for_timeout(2700)
        p.screenshot(path=str(OUT / f"{lang}-08-today-done.png"))
        p.click("[data-view=insights]"); p.wait_for_timeout(500)
        p.screenshot(path=str(OUT / f"{lang}-09-insights.png"), full_page=False)
        p.click("[data-view=week]"); p.wait_for_timeout(400)
        p.screenshot(path=str(OUT / f"{lang}-10-week-proposal.png"))
        p.click("[data-act=lock]"); p.wait_for_timeout(500)
        p.screenshot(path=str(OUT / f"{lang}-11-week-locked.png"))
        if full:
            p.click("[data-view=matches]"); p.wait_for_timeout(400)
            p.screenshot(path=str(OUT / f"{lang}-12-matches.png"))
            p.click("[data-view=settings]"); p.wait_for_timeout(400)
            p.screenshot(path=str(OUT / f"{lang}-13-settings.png"))
            p.click("[data-act=wipe]"); p.wait_for_timeout(300)
            p.screenshot(path=str(OUT / f"{lang}-13b-delete-confirm.png"))
            p.click(".modal [data-r='0']"); p.wait_for_timeout(200)
            assert p.evaluate("LR.store.data.matches.length") > 0, "cancel must keep data"
        # lineups
        l = page_for(ctx, lang)
        l.set_viewport_size({"width": 1120, "height": 760})
        l.goto(BASE + "lineups.html?game=val"); l.wait_for_timeout(500)
        l.click("[data-tog=fav]"); l.wait_for_timeout(300)
        l.screenshot(path=str(OUT / f"{lang}-14-lineups-val.png"))
        if full:
            l.click("[data-game=cs2]"); l.wait_for_timeout(200); l.click("[data-map=Inferno]"); l.wait_for_timeout(200)
            l.click("[data-tog=learned]"); l.wait_for_timeout(300)
            l.screenshot(path=str(OUT / f"{lang}-15-lineups-cs2.png"))
            # remembered pick survives reload
            l.goto(BASE + "lineups.html"); l.wait_for_timeout(500)
            assert l.locator("[data-map=Inferno][aria-pressed=true]").count() == 1, "last map not remembered"
        b.close()

for lang, full in [("sc", True), ("tc", "full" in sys.argv), ("en", "full" in sys.argv)]:
    run(lang, full)
print("\n".join(errors) if errors else "no console errors")
