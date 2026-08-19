package app.guita;

import android.app.Notification;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Escucha las notificaciones de las billeteras (Lemon, Mercado Pago, Cuenta DNI…)
 * y guarda las que hablan de plata en una cola local. La app las lee al abrirse y
 * te propone cargarlas — nunca se anota nada sin que lo confirmes.
 *
 * Solo mira las apps de la lista blanca y solo guarda texto que ya estaba en la
 * notificación. Nada sale del teléfono.
 */
public class GuitaNotifListener extends NotificationListenerService {

    static final String PREFS = "guita";
    static final String KEY_COLA = "notif_cola";
    static final String KEY_ON = "notif_on";
    static final int MAX_COLA = 60;

    /** Paquetes de billeteras y bancos argentinos que nos interesan. */
    private static final String[] PAQUETES = {
        "com.lemoncash", "lemon",
        "com.mercadopago", "com.mercadolibre",
        "ar.com.bapro", "com.bapro",           // Cuenta DNI (Banco Provincia)
        "com.santander", "com.santanderrio",
        "com.astropay",
        "com.balanz",
        "com.brubank", "com.uala", "com.naranja", "ar.com.hsbc",
        "com.bbva", "com.galicia", "ar.com.macro", "com.todopago",
        "com.personalpay", "com.claropay", "com.pagofacil", "com.rapipago",
        "com.bna.movil", "ar.com.icbc", "com.supervielle", "com.patagonia"
    };

    /** Palabras que indican que la notificación habla de un movimiento de plata. */
    private static final String[] PALABRAS = {
        "pagaste", "pago", "compraste", "compra", "gastaste", "transferiste",
        "enviaste", "debitamos", "debito", "débito", "extracción", "extraccion",
        "consumo", "cobraste", "recibiste", "acreditamos", "acreditado",
        "ingreso", "te transfirieron", "te enviaron", "devolución", "devolucion",
        "reintegro", "cashback", "rendimiento", "aprobada", "aprobado"
    };

    private static boolean apoyada(String pkg){
        if(pkg == null) return false;
        String p = pkg.toLowerCase();
        for(String x : PAQUETES) if(p.contains(x)) return true;
        return false;
    }

    private static boolean hablaDePlata(String texto){
        if(texto == null) return false;
        String t = texto.toLowerCase();
        // tiene que mencionar un monto y una palabra de movimiento
        boolean monto = t.contains("$") || t.matches(".*\\d[\\d.]*,\\d{2}.*");
        if(!monto) return false;
        for(String w : PALABRAS) if(t.contains(w)) return true;
        return false;
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn){
        try {
            SharedPreferences pr = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            if(!pr.getBoolean(KEY_ON, false)) return;          // apagado desde la app
            if(!apoyada(sbn.getPackageName())) return;

            Notification n = sbn.getNotification();
            if(n == null) return;
            Bundle ex = n.extras;
            if(ex == null) return;

            String titulo = str(ex.getCharSequence(Notification.EXTRA_TITLE));
            String texto  = str(ex.getCharSequence(Notification.EXTRA_TEXT));
            if(texto.isEmpty()) texto = str(ex.getCharSequence(Notification.EXTRA_BIG_TEXT));
            String junto = (titulo + " " + texto).trim();
            if(!hablaDePlata(junto)) return;

            JSONObject item = new JSONObject();
            item.put("app", sbn.getPackageName());
            item.put("titulo", titulo);
            item.put("texto", texto);
            item.put("cuando", sbn.getPostTime());
            item.put("id", sbn.getPackageName() + "|" + sbn.getPostTime() + "|" + junto.hashCode());

            JSONArray cola = leerCola(pr);
            // no repetir la misma notificación
            for(int i = 0; i < cola.length(); i++){
                if(item.getString("id").equals(cola.getJSONObject(i).optString("id"))) return;
            }
            cola.put(item);
            while(cola.length() > MAX_COLA) cola.remove(0);
            pr.edit().putString(KEY_COLA, cola.toString()).apply();
        } catch(Exception ignored){}
    }

    private static String str(CharSequence cs){ return cs == null ? "" : cs.toString(); }

    static JSONArray leerCola(SharedPreferences pr){
        try { return new JSONArray(pr.getString(KEY_COLA, "[]")); }
        catch(Exception e){ return new JSONArray(); }
    }
}
