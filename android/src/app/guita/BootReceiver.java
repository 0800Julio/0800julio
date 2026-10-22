package app.guita;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

/** Reprograma el recordatorio diario y los avisos después de reiniciar el celu o actualizar la app. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        String a = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(a) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) return;
        AvisoReceiver.reprogramar(ctx);
        SharedPreferences p = ctx.getSharedPreferences(ReminderReceiver.PREFS, Context.MODE_PRIVATE);
        if (p.getBoolean("rem_on", false)) {
            ReminderReceiver.schedule(ctx, p.getInt("rem_h", 21), p.getInt("rem_m", 30));
        }
    }
}
