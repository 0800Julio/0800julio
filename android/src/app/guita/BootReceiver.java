package app.guita;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

/** Reprograma el recordatorio diario después de reiniciar el celu. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        SharedPreferences p = ctx.getSharedPreferences(ReminderReceiver.PREFS, Context.MODE_PRIVATE);
        if (p.getBoolean("rem_on", false)) {
            ReminderReceiver.schedule(ctx, p.getInt("rem_h", 21), p.getInt("rem_m", 30));
        }
    }
}
