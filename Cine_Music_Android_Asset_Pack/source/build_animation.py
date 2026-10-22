"""Native Android splash animation and matching, locally rendered previews."""
import concurrent.futures
from pathlib import Path
import shutil
import subprocess
import xml.etree.ElementTree as ET


def state(t):
    def ease(value):
        value=max(0,min(1,value))
        return value*value*(3-2*value)
    scale=(.92+.105*ease(t/.55)) if t<.55 else (1.025-.025*ease((t-.55)/.29))
    return scale,8*(1-ease(t/.56)),ease(t/.34),ease((t-.18)/.30),ease((t-.36)/.32)


def build_animation(kit):
    root,res=kit.ROOT,kit.RES
    android=kit.ANDROID
    width=246
    group={'name':'cine_artwork','translateX':(432-width)/2,
           'translateY':(432-kit.MARK_H*width/1000)/2,
           'scaleX':width/1000,'scaleY':width/1000}
    vector=kit.native_vector(kit.PATHS,432,432,432,432,group=group,gradients=True)
    index=vector.index('<group ')
    outer='<group android:name="cine_motion" android:pivotX="216" android:pivotY="216" android:scaleX="0.92" android:scaleY="0.92" android:translateY="8">'
    vector=vector[:index]+outer+vector[index:]
    vector=vector.replace('</vector>','</group></vector>')
    for i in range(3):
        vector=vector.replace(f'android:name="cine_path_{i}"',f'android:name="cine_path_{i}" android:fillAlpha="0"')
    kit.write(res/'drawable-v31/ic_cine_splash_motion.xml',vector)
    kit.write(res/'animator-v31/cine_splash_motion.xml',f'''<set xmlns:android="{android}" android:ordering="together">
    <objectAnimator android:duration="840" android:interpolator="@android:interpolator/fast_out_slow_in">
        <propertyValuesHolder android:propertyName="scaleX" android:valueType="floatType">
            <keyframe android:fraction="0" android:value="0.92"/>
            <keyframe android:fraction="0.65" android:value="1.025"/>
            <keyframe android:fraction="1" android:value="1"/>
        </propertyValuesHolder>
        <propertyValuesHolder android:propertyName="scaleY" android:valueType="floatType">
            <keyframe android:fraction="0" android:value="0.92"/>
            <keyframe android:fraction="0.65" android:value="1.025"/>
            <keyframe android:fraction="1" android:value="1"/>
        </propertyValuesHolder>
    </objectAnimator>
    <objectAnimator android:propertyName="translateY" android:valueType="floatType"
        android:valueFrom="8" android:valueTo="0" android:duration="560"
        android:interpolator="@android:interpolator/fast_out_slow_in"/>
</set>
''')
    for name,start,duration in [('cine_splash_c_reveal',0,340),('cine_splash_note_reveal',180,300)]:
        kit.write(res/f'animator-v31/{name}.xml',f'''<objectAnimator xmlns:android="{android}"
    android:propertyName="fillAlpha" android:valueType="floatType"
    android:valueFrom="0" android:valueTo="1" android:startOffset="{start}"
    android:duration="{duration}" android:interpolator="@android:interpolator/fast_out_slow_in"/>
''')
    kit.write(res/'drawable-v31/avd_cine_splash.xml',f'''<animated-vector xmlns:android="{android}"
    android:drawable="@drawable/ic_cine_splash_motion">
    <target android:name="cine_motion" android:animation="@animator/cine_splash_motion"/>
    <target android:name="cine_path_0" android:animation="@animator/cine_splash_c_reveal"/>
    <target android:name="cine_path_1" android:animation="@animator/cine_splash_c_reveal"/>
    <target android:name="cine_path_2" android:animation="@animator/cine_splash_note_reveal"/>
</animated-vector>
''')
    # Select the animated resource only on platform versions that support
    # native launch-icon animation. Older releases keep the static vector.
    themes=res/'values-v31/cine_themes.xml'
    value=themes.read_text().replace('@drawable/ic_cine_splash','@drawable/avd_cine_splash')
    value=value.replace('<item name="windowSplashScreenAnimatedIcon">@drawable/avd_cine_splash</item>',
                        '<item name="windowSplashScreenAnimatedIcon">@drawable/avd_cine_splash</item>\n    <item name="windowSplashScreenAnimationDuration">840</item>')
    kit.write(themes,value)
    layout=res/'layout/cine_brand_welcome.xml'
    kit.write(layout,layout.read_text().replace('<ImageView android:layout_width="192dp"',
               '<ImageView android:id="@+id/cine_welcome_emblem" android:layout_width="192dp"')
               .replace('<ImageView android:layout_width="256dp"',
               '<ImageView android:id="@+id/cine_welcome_wordmark" android:layout_width="256dp"'))
    kit.write(root/'android/CineBrandMotion.kt','''// Optional in-app welcome animation; API 31+ system startup already uses the AVD.
// Call once after inflating cine_brand_welcome.xml if your app needs that screen.
import android.animation.ValueAnimator
import android.os.Build
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator

object CineBrandMotion {
    fun play(emblem: View, wordmark: View) {
        emblem.animate().cancel()
        wordmark.animate().cancel()
        if (Build.VERSION.SDK_INT >= 26 && !ValueAnimator.areAnimatorsEnabled()) {
            emblem.alpha = 1f
            emblem.scaleX = 1f
            emblem.scaleY = 1f
            emblem.translationY = 0f
            wordmark.alpha = 1f
            return
        }
        emblem.alpha = 0f
        emblem.scaleX = 0.92f
        emblem.scaleY = 0.92f
        emblem.translationY = 8f * emblem.resources.displayMetrics.density
        wordmark.alpha = 0f
        emblem.animate().alpha(1f).scaleX(1f).scaleY(1f).translationY(0f)
            .setStartDelay(0L).setDuration(560L)
            .setInterpolator(AccelerateDecelerateInterpolator()).start()
        wordmark.animate().alpha(1f).setStartDelay(360L).setDuration(320L).start()
    }
}
''')
    # SVG previews use complete editable paths and declarative one-shot motion.
    for theme,bg,ink in [('dark',kit.NAVY,kit.IVORY),('light',kit.IVORY,kit.INK)]:
        body='<g transform="translate(270 473)"><g>'
        body+='<animateTransform attributeName="transform" type="scale" values=".92;1.025;1" keyTimes="0;.65;1" dur=".84s" fill="freeze"/>'
        body+='<g transform="translate(-125 -113) scale(.25)">'
        for i,d in enumerate(kit.PATHS):
            timing='values="0;0;1" keyTimes="0;.375;1" dur=".48s"' if i==2 else 'values="0;1" dur=".34s"'
            body+=f'<path d="{d}" fill="url(#cine{i})"><animate attributeName="fill-opacity" {timing} begin="0s" fill="freeze"/></path>'
        body+='</g></g></g>'
        body+=f'<g>{kit.wordmark(100,655,340,ink)}<animate attributeName="opacity" values="0;0;1" keyTimes="0;.529412;1" begin="0s" dur=".68s" fill="freeze"/></g>'
        kit.write(root/f'splash/animation/cine_splash_animated_{theme}.svg',kit.svg_doc(540,1080,body,background=bg))
    kit.write(root/'splash/animation/README.md','''# Animated splash

The default Android 12+ starting theme plays `avd_cine_splash.xml`: an 840 ms C reveal, followed by the music note, with a gentle settle. Native branding placement stays under Android's control. The OS can skip or shorten the animation when the app is ready; no artificial launch delay is installed.

- `cine_splash_preview.gif` and `.mp4`: a playable preview of the dark full-logo composition.
- `cine_splash_animated_dark.svg` and `_light.svg`: editable browser-playable vector reveals. Open directly in a browser; some image viewers display only the final frame.
- Android AVD and animators: `android/res/drawable-v31/` and `android/res/animator-v31/`.
- Optional in-app logo/wordmark motion: `android/CineBrandMotion.kt`.

Below API 31 the system launch screen uses the supplied static vector. The optional view animation can animate a real in-app welcome screen on those devices. Native wordmark branding is static; the full-composition previews also show a wordmark fade for that optional screen. Native AVD and video previews can differ slightly in easing and OS placement.
''')
    readme=root/'README.md'
    kit.write(readme,readme.read_text().replace('transparent native splash icon and branding exports',
               'transparent native icon/branding exports, Android animation, GIF/MP4 preview and animated SVGs'))
    readme=root/'android/README.md'
    value=readme.read_text().replace('The native 288 dp icon keeps', 'The static native 288 dp icon keeps')
    insertion='''## Animated startup

On API 31+, `Theme.CineMusic.Starting` selects the native 432 dp animated-vector resource. Its emblem remains inside the 288 dp visible circle during the 840 ms reveal, rise and settle. Android controls how long startup stays visible and may skip or shorten the motion when the app is already ready. No fixed wait is introduced.

The system launch icon is static below API 31. If your app has a genuine welcome screen, `CineBrandMotion.kt` animates its emblem and wordmark on older devices too. It respects disabled system animations. Call `CineBrandMotion.play(findViewById(R.id.cine_welcome_emblem), findViewById(R.id.cine_welcome_wordmark))` after inflating the provided welcome layout. Preserve your actual launch/navigation flow.

Animated previews and timing notes are in `splash/animation/`. The native system wordmark remains static in the OS branding area; the preview wordmark fade is for the optional in-app composition.

'''
    value=value.replace('## 4. Notifications and controls',insertion+'## 4. Notifications and controls')
    kit.write(readme,value)


def render_motion_preview(kit):
    frames=kit.TMP/'motion_frames'
    frames.mkdir(parents=True,exist_ok=True)
    jobs=[]
    for i in range(22):
        t=i/20
        scale,lift,c_alpha,n_alpha,word_alpha=state(t)
        markw=250
        markh=kit.MARK_H*.25
        body=f'<g transform="translate(270 {360+markh/2+lift}) scale({scale}) translate(-125 {-markh/2})"><g transform="scale(.25)">'
        for k,d in enumerate(kit.PATHS):
            alpha=n_alpha if k==2 else c_alpha
            body+=f'<path d="{d}" fill="url(#cine{k})" fill-opacity="{alpha}"/>'
        body+='</g></g>'
        body+=f'<g opacity="{word_alpha}">{kit.wordmark(100,655,340)}</g>'
        source=kit.write(frames/f'frame_{i:03}.svg',kit.svg_doc(540,1080,body,background=kit.NAVY))
        jobs.append((source,frames/f'frame_{i:03}.png',540,None,True,False))
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(kit.render_job,jobs))
    target=kit.ROOT/'splash/animation'
    command=['convert','-delay','5']+[str(frames/f'frame_{i:03}.png') for i in range(21)]
    command+=['-delay','140',str(frames/'frame_021.png'),'-loop','0','-layers','Optimize',str(target/'cine_splash_preview.gif')]
    subprocess.run(command,check=True)
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate','20',
                    '-i',str(frames/'frame_%03d.png'),'-vf','tpad=stop_mode=clone:stop_duration=1.4',
                    '-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',
                    str(target/'cine_splash_preview.mp4')],check=True)


def validate_animation(kit):
    import math
    from PIL import Image
    namespace='{'+kit.ANDROID+'}'
    avd=ET.parse(kit.RES/'drawable-v31/avd_cine_splash.xml').getroot()
    vec=ET.parse(kit.RES/'drawable-v31/ic_cine_splash_motion.xml').getroot()
    names={node.get(namespace+'name') for node in vec.iter() if node.get(namespace+'name')}
    for target in avd:
        assert target.get(namespace+'name') in names, 'Unresolved animated-vector target'
    # Conservative mask check includes scale overshoot plus the maximum lift.
    with Image.open(kit.ROOT/'icons/adaptive_png/xxxhdpi/cine_foreground.png') as im:
        alpha=im.getchannel('A')
        points=[(((x+.5)/4-54)/58*246,((y+.5)/4-54)/58*246)
                for y in range(im.height) for x in range(im.width) if alpha.getpixel((x,y))>8]
    maxradius=max(math.hypot(x*scale,y*scale+lift)
                  for x,y in points for scale,lift in [(.92,8),(1.025,0),(1,0),(1.025,8)])
    assert maxradius<144, 'Native motion can exceed its circular mask'
    with Image.open(kit.ROOT/'splash/animation/cine_splash_preview.gif') as im:
        assert im.n_frames>1, 'Animated preview has only one frame'
        gif_frames=im.n_frames
    return {'duration_ms':840,'canvas_dp':432,'visible_circle_dp':288,'targets_resolve':True,
            'conservative_motion_radius_dp':round(maxradius,3),'preview_gif_frames':gif_frames}
