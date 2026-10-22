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
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

/**
 * Avisos con día y hora: vencimientos hoy, eventos de la agenda mañana.
 *
 * La app web es la dueña de la lista: cada vez que abre manda la lista entera con
 * {@link #sincronizar}, y acá se cancela lo que ya no está y se programa lo nuevo.
 * La lista queda guardada para reprogramarla después de reiniciar el celu o de
 * actualizar la app, que es cuando Android borra las alarmas.
 *
 * Usa alarmas exactas: en Android 13+ el permiso USE_EXACT_ALARM se otorga al
 * instalar. Si por algún motivo no están disponibles, cae a una alarma que igual
 * despierta al celu, con unos minutos de margen.
 */
public class AvisoReceiver extends BroadcastReceiver {
    static final String PREFS = "guita_avisos";
    static final String KEY = "lista";
    static final String CHANNEL = "guita_avisos";
    static final String ACTION = "app.guita.AVISO";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (intent == null || !ACTION.equals(intent.getAction())) return;
        String id = intent.getStringExtra("id");
        mostrar(ctx, id == null ? "aviso" : id,
                intent.getStringExtra("titulo"), intent.getStringExtra("texto"),
                intent.getStringExtra("icono"));
        // ya sonó: sacarlo de la lista para no reprogramarlo después de un reinicio
        if (id != null) {
            try {
                JSONArray vieja = leer(ctx), nueva = new JSONArray();
                for (int i = 0; i < vieja.length(); i++) {
                    JSONObject o = vieja.optJSONObject(i);
                    if (o != null && !id.equals(o.optString("id"))) nueva.put(o);
                }
                guardar(ctx, nueva);
            } catch (Exception ignored) {}
        }
    }

    /** El ícono que elegiste en Ajustes → Avisos; si no se reconoce, la campana. */
    static int icono(String nombre) {
        if (nombre == null) return R.drawable.ic_n_campana;
        switch (nombre) {
            case "billetera": return R.drawable.ic_n_billetera;
            case "calendario": return R.drawable.ic_n_calendario;
            case "rayo": return R.drawable.ic_n_rayo;
            case "estrella": return R.drawable.ic_n_estrella;
            case "corazon": return R.drawable.ic_n_corazon;
            case "olla": return R.drawable.ic_n_olla;
            case "juli": return R.drawable.ic_n_juli;
            default: return R.drawable.ic_n_campana;
        }
    }

    static void mostrar(Context ctx, String id, String titulo, String texto) {
        mostrar(ctx, id, titulo, texto, null);
    }

    static void mostrar(Context ctx, String id, String titulo, String texto, String icono) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        canal(ctx);
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 200, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(ctx, CHANNEL)
                : new Notification.Builder(ctx);
        b.setSmallIcon(icono(icono))
                .setColor(0xFFC8F06B)
                .setContentTitle(titulo == null || titulo.isEmpty() ? "Recordatorio" : titulo)
                .setContentIntent(pi)
                .setAutoCancel(true);
        if (texto != null && !texto.isEmpty()) {
            b.setContentText(texto);
            b.setStyle(new Notification.BigTextStyle().bigText(texto));
        }
        if (Build.VERSION.SDK_INT < 26) b.setPriority(Notification.PRIORITY_HIGH);
        nm.notify(id.hashCode(), b.build());
    }

    static void canal(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(
                CHANNEL, "Vencimientos y recordatorios", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Lo que vence y lo que agendaste");
        nm.createNotificationChannel(ch);
    }

    /** Reemplaza la lista entera: cancela lo que ya no está, programa lo que falta. */
    static int sincronizar(Context ctx, String json) {
        JSONArray nueva;
        try { nueva = new JSONArray(json == null ? "[]" : json); }
        catch (Exception e) { return -1; }
        long ahora = System.currentTimeMillis();
        Set<String> ids = new HashSet<>();
        JSONArray futuras = new JSONArray();
        for (int i = 0; i < nueva.length(); i++) {
            JSONObject o = nueva.optJSONObject(i);
            if (o == null) continue;
            String id = o.optString("id", "");
            long when = o.optLong("when", 0);
            if (id.isEmpty() || when <= ahora) continue;
            ids.add(id);
            futuras.put(o);
        }
        JSONArray vieja = leer(ctx);
        for (int i = 0; i < vieja.length(); i++) {
            JSONObject o = vieja.optJSONObject(i);
            if (o == null) continue;
            String id = o.optString("id", "");
            if (!ids.contains(id)) cancelar(ctx, id);
        }
        for (int i = 0; i < futuras.length(); i++) {
            JSONObject o = futuras.optJSONObject(i);
            programar(ctx, o.optString("id"), o.optLong("when"),
                    o.optString("titulo"), o.optString("texto"), o.optString("icono", null));
        }
        guardar(ctx, futuras);
        return futuras.length();
    }

    /** Después de reiniciar o actualizar: vuelve a programar lo que estaba guardado. */
    static void reprogramar(Context ctx) {
        sincronizar(ctx, leer(ctx).toString());
    }

    static void programar(Context ctx, String id, long when, String titulo, String texto) {
        programar(ctx, id, when, titulo, texto, null);
    }

    static void programar(Context ctx, String id, long when, String titulo, String texto, String icono) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = pendiente(ctx, id, titulo, texto, icono);
        try {
            if (exactas(ctx)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pi);
        }
    }

    static void cancelar(Context ctx, String id) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pendiente(ctx, id, null, null, null));
    }

    static boolean exactas(Context ctx) {
        if (Build.VERSION.SDK_INT < 31) return true;
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        return am != null && am.canScheduleExactAlarms();
    }

    static int cantidad(Context ctx) { return leer(ctx).length(); }

    /* Un PendingIntent distinto por aviso: el id viaja en la URI, que es lo que Android compara. */
    private static PendingIntent pendiente(Context ctx, String id, String titulo, String texto, String icono) {
        Intent i = new Intent(ctx, AvisoReceiver.class);
        i.setAction(ACTION);
        i.setData(Uri.parse("guita://aviso/" + Uri.encode(id)));
        i.putExtra("id", id);
        if (titulo != null) i.putExtra("titulo", titulo);
        if (texto != null) i.putExtra("texto", texto);
        if (icono != null) i.putExtra("icono", icono);
        return PendingIntent.getBroadcast(ctx, id.hashCode(), i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static JSONArray leer(Context ctx) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try { return new JSONArray(p.getString(KEY, "[]")); }
        catch (Exception e) { return new JSONArray(); }
    }

    private static void guardar(Context ctx, JSONArray a) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, a.toString()).apply();
    }
}
