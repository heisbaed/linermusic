package com.heisbaed.cinemusic;
import android.app.job.*;
import java.util.concurrent.*;
public final class MusicNotificationJob extends JobService {
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private Future<?> task;
    public boolean onStartJob(JobParameters params){task=worker.submit(()->{NotificationHub.check(this);if(!Thread.currentThread().isInterrupted())jobFinished(params,false);});return true;}
    public boolean onStopJob(JobParameters params){if(task!=null)task.cancel(true);return true;}
    public void onDestroy(){worker.shutdownNow();super.onDestroy();}
}
