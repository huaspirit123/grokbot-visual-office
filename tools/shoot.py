"""Headless screenshots: python3 tools/shoot.py URL OUT.png [W H DPR] [--click agentId|team] [--wait ms] [--allow HOST]
Every request to a host other than 127.0.0.1 / localhost (or an --allow host) is blocked, so a test never reaches a real server."""
import sys, asyncio, json
from playwright.async_api import async_playwright
async def main():
    a = sys.argv[1:]; url, out = a[0], a[1]
    W, H, D = (int(a[2]), int(a[3]), float(a[4])) if len(a) > 4 and not a[2].startswith('--') else (1440, 900, 1)
    click = a[a.index('--click') + 1] if '--click' in a else None
    wait = int(a[a.index('--wait') + 1]) if '--wait' in a else 9000
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        allow = {'127.0.0.1', 'localhost', ''} | {a[i + 1] for i, x in enumerate(a) if x == '--allow'}; blocked = []
        from urllib.parse import urlparse
        async def guard(r):
            u = urlparse(r.request.url)
            if u.scheme in ('data', 'blob', 'about') or (u.hostname or '') in allow: await r.continue_()
            else: blocked.append(r.request.url); await r.abort()
        ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=D, has_touch=W < 600, is_mobile=W < 600)
        await ctx.route('**/*', guard)
        pg = await ctx.new_page()
        errs = []
        pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        await pg.goto(url)
        try: await pg.wait_for_function('window.__visualOfficeReady', timeout=15000)
        except Exception:
            print('NOT READY'); print('\n'.join(errs)); await pg.screenshot(path=out); await b.close(); return
        await pg.wait_for_timeout(wait)
        if click:
            if click == 'team': await pg.click('#b-team')
            else:
                pos = await pg.evaluate('id => VisualOffice.app.engine.charScreen(id)', click)
                await pg.mouse.click(pos['x'], pos['y'] + 12)
            await pg.wait_for_timeout(700)
        await pg.screenshot(path=out)
        info = await pg.evaluate('''() => { const e = VisualOffice.app.engine; return {P: e.cam.P, src: VisualOffice.app.src.source, meeting: VisualOffice.app.meeting && VisualOffice.app.meeting.name,
          chars: Object.values(e.chars).map(c => [c.a.name, c.a.status, c.mode, c.pose, c.act||'', Math.round(c.x*10)/10, Math.round(c.y*10)/10, c.path.length]) } }''')
        print(json.dumps(info, ensure_ascii=False)); print('\n'.join(errs) or 'no console errors'); print('blocked:', blocked or 'none')
        await b.close()
asyncio.run(main())
