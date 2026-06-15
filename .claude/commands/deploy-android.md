# Deploy Android

Compila el proyecto Angular y lo despliega en el dispositivo Android conectado vía ADB.

## Pasos

Ejecuta los siguientes comandos en orden, deteniéndote si alguno falla:

1. **Build Angular** — `npx ng build --configuration development`
   - Usar SIEMPRE `--configuration development`. El build de producción causa pantalla negra en Android (ver sección de bugs conocidos).
   - Si falla: reporta el error de compilación y para.

2. **Sync Capacitor** — `npx cap sync android`
   - Si falla: reporta el error y para.

3. **Verificar ajustes nativos** — antes de compilar el APK, comprobar (y corregir si hace falta):
   - `android/app/src/main/AndroidManifest.xml`: la activity debe llevar
     `android:screenOrientation="sensorLandscape"` (NO `"landscape"`). Con `landscape` a secas
     el juego no rota al girar el móvil 180° al otro landscape.
   - `MainActivity.java` con el modo inmersivo (ver sección de bugs conocidos).
   - `MainActivity.java` con `lp.preferredRefreshRate = 60f` en `onCreate()` (ver
     sección de rendimiento). Sin esto, en pantallas de 120Hz el juego da judder.
   - `AndroidManifest.xml`: la `<application>` debe llevar `android:appCategory="game"`
     (ver sección de rendimiento).
   - `MainActivity.java` con el modo cutout `shortEdges` en `hideSystemUI()` (notch):
     ```java
     if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
         getWindow().getAttributes().layoutInDisplayCutoutMode =
             WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
     }
     ```
     (requiere `import android.view.WindowManager;`). Sin esto Android mete una franja
     negra en el lado del notch. La UI web se protege con `env(safe-area-inset-*)`
     (variables `--safe-left/right` en `global.scss`).

4. **Build APK** — Desde `android/`, ejecutar `.\gradlew.bat assembleDebug`
   - El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`

5. **Instalar en el móvil** — `adb -s <device-id> install -r <ruta-apk>`
   - Obtener device-id con `adb devices`
   - Si el móvil pide confirmación en pantalla, aceptarla y reintentar.

## Bugs conocidos

### Pantalla negra en Android (producción)
- **Síntoma**: La app abre y se queda en negro. En logcat aparece `NullInjectorError: No provider for <clase_minificada>!`
- **Causa**: El build de producción de Angular minifica los nombres de clase y rompe el tree-shaking de Angular DI.
- **Solución**: Usar siempre `--configuration development` para builds de Android.

### TranslateHttpLoader versión incorrecta
- **Síntoma**: Error de compilación `TS2554: Expected 0 arguments, but got 3` en `app.module.ts`
- **Causa**: `@ngx-translate/http-loader@17` instalado en lugar de `@16`. La v17 cambió el constructor.
- **Solución**: `npm install @ngx-translate/http-loader@16.0.1`

### El juego no rota al girar el móvil al otro landscape
- **Síntoma**: La app queda fija en un solo sentido horizontal; al girar el móvil 180° la imagen no se voltea.
- **Causa**: `android:screenOrientation="landscape"` en el AndroidManifest clava un único sentido.
- **Solución**: Usar `android:screenOrientation="sensorLandscape"` en la activity de
  `android/app/src/main/AndroidManifest.xml`. El `configChanges` de la activity ya incluye
  `orientation|screenSize`, así que el giro no reinicia la app.
- **Nota**: `android/` está en `.gitignore` — si se regenera con `cap add android`, reaplicar a mano (paso 3).

### Barras del sistema visibles encima de la app (status bar, nav bar)
- **Síntoma**: La barra de notificaciones y/o los botones de navegación de Android se superponen al contenido de la app.
- **Causa**: `MainActivity.java` no configura el modo inmersivo.
- **Solución**: `android/app/src/main/java/io/ionic/starter/MainActivity.java` debe tener el modo inmersivo configurado. Si el archivo solo contiene `public class MainActivity extends BridgeActivity {}`, reemplazarlo con:

```java
package io.ionic.starter;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Fija el refresco a 60Hz: el juego no sostiene 120Hz y daba judder (ver Rendimiento).
        WindowManager.LayoutParams lp = getWindow().getAttributes();
        lp.preferredRefreshRate = 60f;
        getWindow().setAttributes(lp);
        hideSystemUI();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUI();
        }
    }

    private void hideSystemUI() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
            );
        }
    }
}
```

- **Nota**: `android/` está en `.gitignore`, así que este archivo no aparece en git. Verificar su contenido antes de cada build si se regeneró con `cap add android`.

## Rendimiento

Las optimizaciones de rendimiento (junio 2026) se reparten en dos sitios:

**En código web (`src/`) — ya commiteado en git, viaja en cada build, CERO mantenimiento:**
- `NATIVE_DPR` capado a 2 en `scenes/gamescene/constants.ts` (la GPU móvil estaba al límite por fillrate).
- Carga perezosa de texturas de equipo en `gamescene.ts` (solo lo equipado, no todo `EQUIP_LAYER_REGISTRY` → evita ~600MB VRAM).
- Phaser fuera de la zona de Angular + tick de CD a ~30Hz en `layout.component.ts`.

**En `android/` (gitignored) — verificar en el paso 3. NO se pierde en builds normales (`cap sync` + gradle NO sobrescriben estos archivos); SOLO hay que reaplicarlo si se regenera `android/` desde cero (`cap add android`):**
- `MainActivity.java` → `lp.preferredRefreshRate = 60f` en `onCreate()`. La pantalla de 120Hz que el juego no sostiene (frame ~10ms) provocaba judder; fijarla a 60Hz alinea cada frame a un vsync. NO usar `fps:{forceSetTimeOut}` de Phaser para esto (da 60 pero sin alinear a vsync → judder igual).
- `AndroidManifest.xml` → `android:appCategory="game"` en `<application>` (las ROMs tratan mejor a los juegos al repartir CPU).

**Ajuste manual del dispositivo (NO es código, una vez por móvil):**
- Ajustes → Apps → [app] → Ahorrador de batería → **Sin restricciones**. El lag "al quitar el cable" es el power keeper de MIUI/Xiaomi/Oppo throttleando el SoC al ir a batería, no un bug. Con "Sin restricciones" recupera 60fps en ~8s. Es el arreglo más fiable para el usuario final en ROMs agresivos.

**Medir el FPS REAL:** `this.game.loop.actualFps` de Phaser (loguear con `console.log` → sale en logcat como `Capacitor/Console`). NO usar `adb dumpsys gfxinfo`: mide la composición de la surface del WebView (120Hz, frames repetidos), no el bucle del juego, y engaña. Para medir sin cable, usar ADB por WiFi (sobrevive al desenchufar).

**Pendiente (palanca grande de render sin tocar DPR):** bakear las ~7 capas equipadas del jugador en una sola RenderTexture (7 draw calls → 1).

## Notas
- El dispositivo puede estar conectado por WiFi (ADB over Wi-Fi). Verificar con `adb devices` antes de instalar.
- Requiere que JAVA_HOME esté configurado. Si falla, ejecutar: `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"`
