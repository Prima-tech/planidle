# Deploy Android

Compila el proyecto Angular y lo despliega en el dispositivo Android conectado vía ADB.

## Pasos

Ejecuta los siguientes comandos en orden, deteniéndote si alguno falla:

1. **Build Angular** — `npm run build`
   - Si falla: reporta el error de compilación y para.

2. **Sync Capacitor** — `npx cap sync android`
   - Si falla: reporta el error y para.

3. **Deploy al móvil** — `npx cap run android`
   - Requiere que JAVA_HOME esté configurado. Si falla por JAVA_HOME, recuerda al usuario que ejecute: `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"`
   - Si falla por ADB: verifica que el dispositivo esté conectado con `adb devices`.

Reporta el resultado de cada paso (éxito o error) antes de continuar al siguiente.
