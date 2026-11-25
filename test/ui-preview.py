import json, threading, functools, subprocess, io, wave, struct, math
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright, expect

root=Path(__file__).resolve().parents[1]
state=json.loads(subprocess.check_output(['node','-e',"const {normalizeConfig}=require('./src/core/config.cjs');const {BUILTINS}=require('./src/core/presets.cjs');console.log(JSON.stringify({config:normalizeConfig({selectedPreset:'sao-aincrad'}),builtins:BUILTINS,security:{configured:true,unlocked:true},configured:true,authenticated:false,ready:true,appVersion:'0.5.0',hostMode:'fixture',nativeStatus:{installed:false},integration:{state:'disconnected'}}))"],cwd=root,text=True,encoding='utf-8'))
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'
with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',args=['--autoplay-policy=no-user-gesture-required'])
    context=browser.new_context(viewport={'width':1440,'height':960})
    page=context.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_init_script('window.fixture='+json.dumps(state,ensure_ascii=False)+''';window.custom={bootstrap:async()=>window.fixture,unlock:async()=>{},setup:async()=>{},save:async config=>{window.fixture.config=config;return window.fixture},onState:()=>{},onIntegrationStatus:()=>{}};''')
    page.goto(base+'/src/renderer/index.html')
    page.locator('#password').fill('fixture-password')
    page.locator('#auth-submit').click()
    page.locator('#workspace').wait_for(state='visible')
    before_apply=page.evaluate('JSON.stringify({splash:window.fixture.config.splash,wallpaper:window.fixture.config.wallpaper,rg:window.fixture.config.rg})')
    page.locator('#apply-sao').click()
    expect(page.locator('#audio-file')).to_contain_text('Swordland')
    assert page.evaluate('window.fixture.config.splash.musicScope')=='startup'
    after_apply=page.evaluate('JSON.stringify({splash:window.fixture.config.splash,wallpaper:window.fixture.config.wallpaper,rg:window.fixture.config.rg})')
    assert json.loads(before_apply)==json.loads(after_apply)
    page.locator('#listen-sao').click()
    page.locator('#stop-sao-audio').click()
    page.evaluate('document.fonts.ready')
    expect(page.locator('.theme-card').first).to_have_css('opacity','1')
    expect(page.locator('.theme-card').nth(1)).to_have_css('opacity','1')
    page.screenshot(path=str(root/'work/sao-dashboard.png'),full_page=True)
    assert page.locator('[data-preset="sao-aincrad"]').get_attribute('aria-pressed')=='true'
    for id in ['sao-alfheim','sao-ggo','sao-calibur','sao-rosario','gundam','sao-aincrad']:
        page.locator(f'[data-preset="{id}"]').click()
        assert page.locator('#selected-name').inner_text()==next(t['name'] for t in state['builtins'] if t['id']==id)
        if id=='gundam':assert page.locator('.sao-setup').is_hidden()
        else:assert page.locator('.sao-setup').is_visible()
    page.locator('#preset-motion').uncheck()
    assert page.locator('body').evaluate("e=>e.classList.contains('reduced-motion')")
    page.locator('#preset-motion').check()
    page.locator('#preview-button').click()
    page.locator('#splash-overlay').wait_for(state='visible')
    assert page.locator('#splash-video').get_attribute('src').endswith('/sao.mp4')
    page.locator('#skip-splash').click()
    page.locator('#splash-overlay').wait_for(state='hidden')
    # Tauri private audio crosses authenticated IPC, then plays through a local Blob.
    wav_buffer=io.BytesIO()
    with wave.open(wav_buffer,'wb') as out:
        out.setnchannels(1);out.setsampwidth(2);out.setframerate(8000)
        out.writeframes(b''.join(struct.pack('<h',int(1200*math.sin(i*2*math.pi*440/8000))) for i in range(16000)))
    tauri_state=json.loads(json.dumps(state));tauri_state['hostMode']='tauri-native'
    tauri_state['config']['splash'].update(soundEnabled=True,chime=False)
    tauri_state['config']['rg']['startupAudioId']='abcdef12-abcd-abcd-abcd-abcdef123456.wav'
    tauri_state['config']['splash']['themeAudioIds']={'gundam':'abcdef12-abcd-abcd-abcd-abcdef123456.wav','focus':'abcdef12-abcd-abcd-abcd-abcdef123456.wav'}
    tauri=context.new_page();tauri.on('pageerror',lambda e:errors.append(str(e)))
    tauri.add_init_script('window.fixture='+json.dumps(tauri_state,ensure_ascii=False)+';window.fixtureWav='+json.dumps(list(wav_buffer.getvalue()))+''';window.previewReads=0;
        const NativeAudio=window.Audio;window.Audio=function(src){const audio=new NativeAudio(src);window.lastPreviewAudio=audio;return audio;};
        window.__TAURI__={core:{invoke:async(name,args)=>{switch(name){
        case 'bootstrap':return window.fixture;case 'unlock':return {};case 'save':window.fixture.config=args.config;return window.fixture;
        case 'preview_audio':window.previewReads++;return{mime:'audio/wav',bytes:window.fixtureWav};default:throw new Error('Unexpected command: '+name);}}}};''')
    tauri.goto(base+'/src/renderer/index.html')
    tauri.locator('#password').fill('fixture-password');tauri.locator('#auth-submit').click()
    for selected in ['gundam','focus','paper']:
        tauri.locator(f'[data-preset="{selected}"]').click()
        tauri.locator('#preview-button').click()
        tauri.locator('#splash-overlay').wait_for(state='visible')
        expect(tauri.locator('#splash-status')).to_contain_text('Xem trước')
        assert tauri.evaluate('window.lastPreviewAudio.src.startsWith("blob:")')
        assert tauri.evaluate('!window.lastPreviewAudio.paused')
        tauri.locator('#skip-splash').click();tauri.locator('#splash-overlay').wait_for(state='hidden')
        assert tauri.evaluate('window.lastPreviewAudio.paused')
    assert tauri.evaluate('window.previewReads')==3
    for selected in ['gundam','focus','paper']:
        tauri.locator(f'[data-preset="{selected}"]').click()
        tauri.locator('[data-panel="splash"]').click()
        tauri.locator('[data-clear="audio"]').click()
        expect(tauri.locator('#audio-file')).to_contain_text('Yuki Hayashi')
        tauri.locator('[data-panel="themes"]').click()
        tauri.locator('#preview-button').click()
        tauri.locator('#splash-overlay').wait_for(state='visible')
        expect(tauri.locator('#splash-status')).to_contain_text('Xem trước')
        assert tauri.evaluate('window.lastPreviewAudio.src.endsWith("/audio/gundam-background.mp3")')
        assert tauri.evaluate('!window.lastPreviewAudio.paused')
        tauri.locator('#skip-splash').click();tauri.locator('#splash-overlay').wait_for(state='hidden')
    assert tauri.evaluate('window.previewReads')==3
    # Native page uses installed layout; route renderer resources as the installer does.
    native=context.new_page()
    native.on('pageerror',lambda e:errors.append(str(e)))
    native.route('**/src/native/renderer/**',lambda route:route.fulfill(path=str(root/'src/renderer'/route.request.url.split('/src/native/renderer/')[1])))
    native_state=json.loads(json.dumps(state))
    native_state['config']['splash'].update(soundEnabled=True,musicScope='startup',chime=False)
    native_state['audioUrl']=base+'/src/renderer/audio/swordland.mp3'
    native_state['cueAudioUrls']={'authenticated':base+'/src/renderer/audio/sao-link-start.mp3'}
    native.add_init_script('window.fixture='+json.dumps(native_state,ensure_ascii=False)+''';window.nativeCustom={bootstrap:async()=>window.fixture,authenticate:async({password})=>{if(password!=='fixture-password')throw new Error('Wrong fixture password');return{ready:true}},onReady:()=>{},voiceActivity:async()=>{},muteSound:async()=>{},finish:async()=>({finished:true})};''')
    native.goto(base+'/src/native/splash.html')
    native.locator('body[data-theme-family="sao"]').wait_for(state='attached')
    native.evaluate('document.fonts.ready')
    expect(native.locator('#consent')).to_have_css('opacity','1')
    expect(native.locator('#startup-music')).to_have_js_property('paused',False)
    rect=native.locator('#consent').bounding_box()
    assert abs(rect['x']+rect['width']/2-720)<2
    assert abs(rect['y']+rect['height']/2-480)<2
    native.screenshot(path=str(root/'work/sao-native.png'))
    native.locator('#begin').click()
    native.locator('#password').fill('incorrect-fixture')
    native.locator('#authenticate').click()
    expect(native.locator('#auth-error')).to_contain_text('Wrong fixture password')
    assert native.locator('#cue-audio').evaluate('e=>e.paused')
    native.locator('#password').fill('fixture-password')
    native.locator('#authenticate').click()
    expect(native.locator('#cue-audio')).to_have_js_property('paused',False)
    assert native.locator('#cue-audio').evaluate('e=>e.src').endswith('sao-link-start.mp3')
    assert native.locator('#startup-music').evaluate('e=>e.volume')==.07
    native.locator('#welcome').wait_for(state='visible')
    native.screenshot(path=str(root/'work/sao-native-ready.png'))
    native.locator('#enter-system').click()
    expect(native.locator('#startup-music')).to_have_js_property('paused',True)
    expect(native.locator('#cue-audio')).to_have_js_property('paused',True)
    # Even old configs requesting session music now stop on successful entry.
    native_state['config']['splash']['musicScope']='session'
    closing=context.new_page()
    closing.route('**/src/native/renderer/**',lambda route:route.fulfill(path=str(root/'src/renderer'/route.request.url.split('/src/native/renderer/')[1])))
    closing_state=json.loads(json.dumps(native_state));closing_state['closing']=True
    closing.add_init_script('window.fixture='+json.dumps(closing_state,ensure_ascii=False)+''';window.nativeCustom={bootstrap:async()=>window.fixture,onReady:()=>{},voiceActivity:async()=>{},muteSound:async()=>{}};''')
    closing.goto(base+'/src/native/splash.html')
    expect(closing.locator('body')).to_have_attribute('data-flow','shutdown')
    for id in ['startup-music','cue-audio','cinematic-audio']:
        assert closing.locator('#'+id).evaluate('e=>e.paused&&!e.getAttribute("src")')
    assert closing.locator('#sound-toggle').is_hidden()
    closing.screenshot(path=str(root/'work/sao-ending.png'))
    for selected in ['gundam','focus','paper']:
        gundam=context.new_page()
        gundam.route('**/src/native/renderer/**',lambda route:route.fulfill(path=str(root/'src/renderer'/route.request.url.split('/src/native/renderer/')[1])))
        gundam_state=json.loads(json.dumps(native_state));gundam_state['config']['selectedPreset']=selected
        gundam_state['config']['rg']['audioMode']='events';gundam_state['cueAudioUrls']={}
        gundam_state['startupAudioUrl']=base+'/src/renderer/audio/sao-link-start.mp3'
        gundam_state['audioUrl']=base+'/src/renderer/audio/gundam-background.mp3'
        gundam_state['config']['rg']['audioMode']='track'
        gundam_state['cueAudioUrls']={'begin':base+'/src/renderer/audio/gundam-gp-base.mp3'}
        gundam.add_init_script('window.fixture='+json.dumps(gundam_state,ensure_ascii=False)+''';window.nativeCustom={bootstrap:async()=>window.fixture,onReady:()=>{},voiceActivity:async()=>{},muteSound:async()=>{}};''')
        gundam.goto(base+'/src/native/splash.html')
        expect(gundam.locator('#startup-music')).to_have_js_property('paused',False)
        assert gundam.locator('#startup-music').evaluate('e=>e.src.endsWith("gundam-background.mp3")')
        assert gundam.locator('#cue-audio').evaluate('e=>e.paused')
        gundam.locator('#begin').click()
        expect(gundam.locator('#cue-audio')).to_have_js_property('paused',False)
        assert gundam.locator('#cue-audio').evaluate('e=>e.src.endsWith("gundam-gp-base.mp3")')
        assert gundam.locator('#cinematic-audio').evaluate('e=>e.paused')
        assert gundam.locator('#startup-music').evaluate('e=>e.volume')==.07
        ending=context.new_page()
        ending.route('**/src/native/renderer/**',lambda route:route.fulfill(path=str(root/'src/renderer'/route.request.url.split('/src/native/renderer/')[1])))
        ending_state=json.loads(json.dumps(gundam_state));ending_state['closing']=True
        ending_state['startupAudioUrl']='';ending_state['endAudioUrl']=base+'/src/renderer/audio/gundam-session-end.mp3'
        ending.add_init_script('window.fixture='+json.dumps(ending_state,ensure_ascii=False)+''';window.nativeCustom={bootstrap:async()=>window.fixture,onReady:()=>{},voiceActivity:async()=>{},muteSound:async()=>{}};''')
        ending.goto(base+'/src/native/splash.html')
        expect(ending.locator('#cinematic-audio')).to_have_js_property('paused',False)
        assert ending.locator('#cinematic-audio').evaluate('e=>e.src.endsWith("gundam-session-end.mp3")')
        assert ending.locator('#startup-music').evaluate('e=>e.paused')
    native.emulate_media(reduced_motion='reduce');native.reload()
    native.locator('body.reduced-motion').wait_for(state='attached')
    assert native.locator('#backdrop-video').is_hidden()
    assert native.locator('#backdrop-image').is_visible()
    assert not errors,errors
    print('PASS: all three Gundam/Focus presets play private audio in Tauri Blob previews and native splashes; floating SAO; SAO-only controls; startup scope; entry stops audio; silent ending; auth safety; reduced motion; no page errors')
    browser.close()
server.shutdown()
