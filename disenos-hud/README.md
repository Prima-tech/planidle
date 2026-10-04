# Valhalla · HUD Design Lab

Abre `index.html` en el navegador. La galería funciona sin instalar nada y sin conexión.

También puedes servirla desde la raíz del proyecto:

```powershell
node disenos-hud/serve.cjs
```

Abre http://127.0.0.1:4173.

Incluye seis propuestas independientes: Reliquia, Vanguardia, Nexo, Saga, Eclipse y Bruma. Cada una muestra la zona plegada y desplegada, con pestañas de combate, minería, tala y dominio. Los controles permiten cambiar la vida, simular daño y curación, elegir el fondo y guardar favoritos en este navegador. «Ver en detalle» abre una vista ampliada; Esc la cierra. ES/EN cambia el idioma.

Los datos son de muestra. No hay conexión con la partida ni con los servicios del juego. El código y los recursos de esta carpeta se pueden copiar juntos a otra ubicación.

Los mapas, iconos y la fuente se reutilizan del proyecto. La licencia de Pixelify Sans está en `assets/PixelifySans-OFL.txt`.

Verificación realizada en navegador: seis propuestas y doce vistas, todas las pestañas, plegado independiente, límites de vida 0–100%, estado crítico, curación, favoritos, cambio de idioma, navegación de pestañas con teclado y vista de detalle. Comprobados anchos de 320, 390, 768 y 1440 píxeles y apertura directa con `file://`. Sin errores de JavaScript durante la revisión.
