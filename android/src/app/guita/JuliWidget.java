package app.guita;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Juli-o · Hoy: cuánto podés gastar hoy, lo próximo de la agenda y cuatro accesos.
 *
 * La app web calcula todo y lo manda con {@link #guardar}; acá sólo se dibuja. Si el
 * día cambió desde la última vez que abriste la app, el monto de "hoy" pasa a ser el
 * "desde mañana" que ya venía calculado, y la agenda muestra lo que todavía no pasó.
 */
public class JuliWidget extends AppWidgetProvider {
    static final String PREFS = "juli_widget";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) {
        for (int id : ids) pintar(ctx, m, id);
    }

    static void guardar(Context ctx, String json) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("datos", json).apply();
        actualizar(ctx);
    }

    static void actualizar(Context ctx) {
        AppWidgetManager m = AppWidgetManager.getInstance(ctx);
        if (m == null) return;
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, JuliWidget.class))) pintar(ctx, m, id);
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, JuliAccesos.class))) JuliAccesos.pintar(ctx, m, id);
    }

    /** Abre la app en un lugar: guita://ir/anotar, agenda, cocina, pagos. */
    static PendingIntent ir(Context ctx, String destino, int codigo) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setAction(Intent.ACTION_VIEW);
        i.setData(Uri.parse("guita://ir/" + destino));
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(ctx, codigo, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void pintar(Context ctx, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_juli);
        try {
            String raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("datos", null);
            if (raw != null) {
                JSONObject o = new JSONObject(raw);
                String hoy = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
                boolean mismoDia = hoy.equals(o.optString("fecha"));
                if (o.optBoolean("oculto")) {
                    v.setTextViewText(R.id.w_lbl, "PLATA CON CLAVE");
                    v.setTextViewText(R.id.w_monto, "••••");
                    v.setTextColor(R.id.w_monto, 0xFF8D93A0);
                    v.setTextViewText(R.id.w_sub, "Abrí Juli-o para ver tus números");
                } else if (o.has("hoy")) {
                    v.setTextViewText(R.id.w_lbl, o.optString("lbl", "HOY PODÉS GASTAR"));
                    v.setTextViewText(R.id.w_monto, mismoDia ? o.optString("hoy") : o.optString("manana", o.optString("hoy")));
                    v.setTextColor(R.id.w_monto, mismoDia && o.optBoolean("rojo") ? 0xFFFF5A7A : (int) Long.parseLong(o.optString("color", "FFC8F06B"), 16));
                    v.setTextViewText(R.id.w_sub, mismoDia ? o.optString("sub") : "Contando lo de ayer · abrí la app para actualizar");
                } else {
                    v.setTextViewText(R.id.w_lbl, "JULI-O");
                    v.setTextViewText(R.id.w_monto, o.optString("titulo", "Hoy"));
                    v.setTextViewText(R.id.w_sub, o.optString("sub", "Poné una meta de gasto y te digo cuánto podés por día"));
                }
                // la agenda: lo primero que todavía no pasó
                JSONArray ag = o.optJSONArray("agenda");
                String txt = "";
                long ahora = System.currentTimeMillis();
                int quedan = 0;
                if (ag != null) {
                    for (int i = 0; i < ag.length(); i++) {
                        JSONObject a = ag.optJSONObject(i);
                        if (a == null || a.optLong("when") < ahora) continue;
                        if (txt.isEmpty()) txt = a.optString("t");
                        else quedan++;
                    }
                }
                v.setTextViewText(R.id.w_agenda, txt.isEmpty() ? "🗓 Nada más en la agenda" : "🗓 " + txt + (quedan > 0 ? "  · y " + quedan + " más" : ""));
            }
        } catch (Exception ignored) {}
        v.setOnClickPendingIntent(R.id.w_b_gasto, ir(ctx, "anotar", 301));
        v.setOnClickPendingIntent(R.id.w_b_agenda, ir(ctx, "agenda", 302));
        v.setOnClickPendingIntent(R.id.w_b_cocina, ir(ctx, "cocina", 303));
        v.setOnClickPendingIntent(R.id.w_b_pagos, ir(ctx, "pagos", 304));
        v.setOnClickPendingIntent(R.id.w_monto, ir(ctx, "hoy", 305));
        m.updateAppWidget(id, v);
    }
}
