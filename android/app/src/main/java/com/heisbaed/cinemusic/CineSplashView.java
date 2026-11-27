package com.heisbaed.cinemusic;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.Animatable;
import android.view.animation.PathInterpolator;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Branded startup composition, dismissed when the application has rendered. */
final class CineSplashView extends FrameLayout {
    private final ImageView emblem;
    private final TextView wordmark;
    private final TextView credit;
    private final TvSplashMovie movie;
    private boolean revealed;
    private boolean dismissing;

    CineSplashView(Context context) {
        super(context);
        if("tv".equals(BuildConfig.CINE_PLATFORM)){
            emblem=null;wordmark=null;credit=null;
            movie=new TvSplashMovie(context);addView(movie,new FrameLayout.LayoutParams(-1,-1));setClickable(true);return;
        }
        movie=null;
        setBackgroundColor(Color.rgb(18, 8, 17));
        setClickable(true);
        LinearLayout brand = new LinearLayout(context);
        brand.setOrientation(LinearLayout.VERTICAL);
        brand.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams center = new FrameLayout.LayoutParams(-1, -2, Gravity.CENTER);
        center.bottomMargin = dp(32);
        addView(brand, center);
        emblem = new ImageView(context);
        emblem.setImageResource(ValueAnimator.areAnimatorsEnabled()
            ? R.drawable.avd_cine_brand_reveal : R.drawable.cine_brand_static);
        emblem.setContentDescription("Cine music");
        brand.addView(emblem, new LinearLayout.LayoutParams(dp(216), dp(216)));
        wordmark = text("Cine music", 30, Color.rgb(246, 247, 252));
        wordmark.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        LinearLayout.LayoutParams name = new LinearLayout.LayoutParams(-2, -2);
        name.topMargin = 0;
        brand.addView(wordmark, name);
        credit = text("By Osborne's Digital Solutions", 14, Color.rgb(234, 211, 223));
        credit.setPadding(dp(24), 0, dp(24), 0);
        FrameLayout.LayoutParams footer = new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        footer.bottomMargin = dp(32);
        addView(credit, footer);
        setOnApplyWindowInsetsListener((view, insets) -> {
            footer.bottomMargin = dp(24) + insets.getSystemWindowInsetBottom();
            credit.setLayoutParams(footer);
            return insets;
        });
    }

    void reveal() {
        if (revealed) return;
        revealed = true;
        if(movie!=null){movie.reveal();return;}
        if (ValueAnimator.areAnimatorsEnabled()) {
            if (emblem.getDrawable() instanceof Animatable) ((Animatable) emblem.getDrawable()).start();
            wordmark.setAlpha(0);
            wordmark.setTranslationY(dp(8));
            wordmark.animate().alpha(1).translationY(0).setStartDelay(160).setDuration(400)
                .setInterpolator(new PathInterpolator(.16f, 1f, .3f, 1f)).start();
            credit.setAlpha(0);
            credit.animate().alpha(1).setStartDelay(240).setDuration(400).start();
        }
    }

    void dismiss() {
        if (dismissing) return;
        dismissing = true;
        setClickable(false);
        reveal();
        animate().alpha(0).setStartDelay(0).setDuration(ValueAnimator.areAnimatorsEnabled() ? 220 : 0)
            .withEndAction(() -> {
                if (getParent() instanceof ViewGroup) ((ViewGroup) getParent()).removeView(this);
            }).start();
    }

    @Override protected void onDetachedFromWindow() {
        if (emblem!=null && emblem.getDrawable() instanceof Animatable) ((Animatable) emblem.getDrawable()).stop();
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
