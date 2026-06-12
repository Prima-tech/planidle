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
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
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

## Notas
- El dispositivo puede estar conectado por WiFi (ADB over Wi-Fi). Verificar con `adb devices` antes de instalar.
- Requiere que JAVA_HOME esté configurado. Si falla, ejecutar: `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"`
