// Optional in-app welcome animation; API 31+ system startup already uses the AVD.
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
