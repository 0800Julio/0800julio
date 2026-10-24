package app.guita;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

/** Juli-o · Accesos: una fila de botones, sin datos. */
public class JuliAccesos extends AppWidgetProvider {
    @Override
    public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) {
        for (int id : ids) pintar(ctx, m, id);
    }

    static void pintar(Context ctx, AppWidgetManager m, int id) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_accesos);
        v.setOnClickPendingIntent(R.id.a_gasto, JuliWidget.ir(ctx, "anotar", 311));
        v.setOnClickPendingIntent(R.id.a_agenda, JuliWidget.ir(ctx, "agenda", 312));
        v.setOnClickPendingIntent(R.id.a_cocina, JuliWidget.ir(ctx, "cocina", 313));
        v.setOnClickPendingIntent(R.id.a_pagos, JuliWidget.ir(ctx, "pagos", 314));
        m.updateAppWidget(id, v);
    }
}
