# Deploy Android

Compila el proyecto Angular y lo despliega en el dispositivo Android conectado vía ADB.

## Pasos

Ejecuta los siguientes comandos en orden, deteniéndote si alguno falla:

1. **Build Angular** — `npx ng build --configuration development`
   - Usar SIEMPRE `--configuration development`. El build de producción causa pantalla negra en Android (ver sección de bugs conocidos).
   - Si falla: reporta el error de compilación y para.

2. **Sync Capacitor** — `npx cap sync android`
   - Si falla: reporta el error y para.

3. **Build APK** — Desde `android/`, ejecutar `.\gradlew.bat assembleDebug`
   - El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`

4. **Instalar en el móvil** — `adb -s <device-id> install -r <ruta-apk>`
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

## Notas
- El dispositivo puede estar conectado por WiFi (ADB over Wi-Fi). Verificar con `adb devices` antes de instalar.
- Requiere que JAVA_HOME esté configurado. Si falla, ejecutar: `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"`
