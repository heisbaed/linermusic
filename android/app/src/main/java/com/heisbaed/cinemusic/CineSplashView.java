package com.heisbaed.cinemusic;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.Animatable;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Branded startup composition, dismissed when the application has rendered. */
final class CineSplashView extends FrameLayout {
    private final ImageView emblem;
    private boolean dismissing;

    CineSplashView(Context context) {
        super(context);
        setBackgroundColor(Color.rgb(18, 8, 17));
        setClickable(true);
        LinearLayout brand = new LinearLayout(context);
        brand.setOrientation(LinearLayout.VERTICAL);
        brand.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams center = new FrameLayout.LayoutParams(-1, -2, Gravity.CENTER);
        center.bottomMargin = dp(32);
        addView(brand, center);
        emblem = new ImageView(context);
        emblem.setImageResource(R.drawable.avd_cine_splash);
        emblem.setContentDescription("Cine music");
        brand.addView(emblem, new LinearLayout.LayoutParams(dp(216), dp(216)));
        TextView wordmark = text("Cine music", 30, Color.rgb(246, 247, 252));
        wordmark.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        LinearLayout.LayoutParams name = new LinearLayout.LayoutParams(-2, -2);
        name.topMargin = -dp(20);
        brand.addView(wordmark, name);
        TextView credit = text("By Osborne's Digital Solutions", 14, Color.rgb(234, 211, 223));
        credit.setPadding(dp(24), 0, dp(24), 0);
        FrameLayout.LayoutParams footer = new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        footer.bottomMargin = dp(32);
        addView(credit, footer);
        setOnApplyWindowInsetsListener((view, insets) -> {
            footer.bottomMargin = dp(24) + insets.getSystemWindowInsetBottom();
            credit.setLayoutParams(footer);
            return insets;
        });
        if (ValueAnimator.areAnimatorsEnabled()) {
            wordmark.setAlpha(0);
            wordmark.setTranslationY(dp(8));
            wordmark.animate().alpha(1).translationY(0).setStartDelay(160).setDuration(400).start();
        }
        post(() -> {
            if (emblem.getDrawable() instanceof Animatable) ((Animatable) emblem.getDrawable()).start();
        });
    }

    void dismiss() {
        if (dismissing) return;
        dismissing = true;
        setClickable(false);
        animate().alpha(0).setDuration(ValueAnimator.areAnimatorsEnabled() ? 220 : 0)
            .withEndAction(() -> {
                if (getParent() instanceof ViewGroup) ((ViewGroup) getParent()).removeView(this);
            }).start();
    }

    @Override protected void onDetachedFromWindow() {
        if (emblem.getDrawable() instanceof Animatable) ((Animatable) emblem.getDrawable()).stop();
        super.onDetachedFromWindow();
    }

    private TextView text(String label, int size, int color) {
        TextView view = new TextView(getContext());
        view.setText(label);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setGravity(Gravity.CENTER);
        return view;
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
}
