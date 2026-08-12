package app.guita;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import java.util.Calendar;

/**
 * Recordatorio diario "¿anotaste los gastos de hoy?".
 * Alarma inexacta repetida (no requiere permiso de alarmas exactas) que
 * postea una notificación; tocarla abre la app.
 */
public class ReminderReceiver extends BroadcastReceiver {
    static final String PREFS = "guita";
    static final String CHANNEL = "guita_recordatorio";
    static final int REQ_ALARM = 100;
    static final int REQ_OPEN = 101;
    static final int NOTIF_ID = 1;

    @Override
    public void onReceive(Context ctx, Intent intent) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!p.getBoolean("rem_on", false)) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(new NotificationChannel(
                    CHANNEL, "Recordatorio diario", NotificationManager.IMPORTANCE_DEFAULT));
        }
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, REQ_OPEN, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(ctx, CHANNEL)
                : new Notification.Builder(ctx);
        b.setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("¿Anotaste los gastos de hoy? 💸")
                .setContentText("Mantené apretado el micrófono y contale a Guita en qué gastaste.")
                .setContentIntent(pi)
                .setAutoCancel(true);
        nm.notify(NOTIF_ID, b.build());
    }

    static void schedule(Context ctx, int hour, int minute) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putBoolean("rem_on", true).putInt("rem_h", hour).putInt("rem_m", minute).apply();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, hour);
        cal.set(Calendar.MINUTE, minute);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        if (cal.getTimeInMillis() <= System.currentTimeMillis()) cal.add(Calendar.DAY_OF_YEAR, 1);
        am.setInexactRepeating(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(),
                AlarmManager.INTERVAL_DAY, pending(ctx));
    }

    static void cancel(Context ctx) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putBoolean("rem_on", false).apply();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pending(ctx));
    }

    private static PendingIntent pending(Context ctx) {
        return PendingIntent.getBroadcast(ctx, REQ_ALARM, new Intent(ctx, ReminderReceiver.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
