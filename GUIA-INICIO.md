# Guía para iniciar y modificar GymTool

Esta guía sirve para abrir GymTool en Windows y entender cómo se conecta con Firebase. La carpeta ya incluye la configuración web del proyecto Firebase **GymTool SaaS** y las reglas de Firestore preparadas para separar los datos de cada gimnasio.

## 1. Qué necesitás

- Una computadora con conexión a internet.
- [Node.js LTS](https://nodejs.org/). La instalación de Node incluye npm.
- Un editor de código, por ejemplo Visual Studio Code (opcional; también podés editar los archivos con otro editor).

El proyecto no necesita `npm install` para ejecutarse: no tiene dependencias npm locales. El navegador descarga el SDK modular de Firebase desde su CDN cuando abrís la app.

## 2. Descomprimir y abrir el proyecto

1. Descomprimí `GymTool-proyecto-editable.zip` en una carpeta fácil de encontrar, por ejemplo `Documentos\GymTool`.
2. Abrí esa carpeta en Visual Studio Code o el editor que prefieras.
3. Abrí una terminal en esa misma carpeta. En VS Code: **Terminal → Nueva terminal**.
4. Comprobá que Node y npm estén instalados:

   ```powershell
   node --version
   npm --version
   ```

   Si Windows dice que no reconoce alguno de esos comandos, instalá Node.js LTS y volvé a abrir la terminal.

## 3. Ejecutar GymTool

En la terminal abierta dentro de la carpeta del proyecto, iniciá el servidor local:

```powershell
npm run dev
```

Dejá esa ventana abierta mientras uses la aplicación. Abrí en el navegador la dirección que muestra la terminal; normalmente será:

```text
http://localhost:4173
```

Para detener el servidor, volvé a la terminal y presioná `Ctrl+C`. Para abrir GymTool más adelante, repetí `npm run dev` desde la carpeta.

No abras `index.html` haciendo doble clic. El servidor local es necesario para que el navegador pueda cargar los módulos JavaScript y Firebase.

## 4. Firebase ya configurado

El proyecto está conectado a Firebase mediante `firebase-config.js` y `.firebaserc`. En el proyecto Firebase **GymTool SaaS** ya se configuraron Authentication con email/contraseña, la base Cloud Firestore predeterminada y reglas de acceso.

Si ejecutás esta copia tal como está, usa ese proyecto compartido: las cuentas y los datos que crees se guardan en Firebase y estarán disponibles desde otros dispositivos que inicien sesión. No cargues información de prueba si querés mantener esos datos limpios.

En el primer uso, elegí **Crear cuenta**, registrá tu nombre, email y contraseña, y luego completá el nombre y la ciudad del gimnasio. La app crea el perfil y el gimnasio y lo vincula con tu usuario. En los siguientes accesos, iniciá sesión con el mismo email y contraseña.

## 5. Si querés conectar otro proyecto Firebase

Usá estos pasos si vas a crear una copia independiente para experimentar o si cambiás de proyecto:

1. En [Firebase Console](https://console.firebase.google.com/), creá o seleccioná el proyecto nuevo.
2. Registrá una aplicación web y copiá el objeto de configuración que Firebase muestra. La [guía oficial de configuración web](https://firebase.google.com/docs/web/setup?hl=es-419) explica este proceso.
3. En **Authentication → Sign-in method**, habilitá **Email/Password**. La [guía oficial de autenticación](https://firebase.google.com/docs/auth/web/password-auth?hl=en) describe el proveedor.
4. En **Firestore Database**, creá la base de datos predeterminada en modo de producción. Elegí una ubicación cercana a quienes usarán el sistema; la ubicación no se puede cambiar después de crear la base.
5. Abrí `firebase-config.js` y reemplazá los valores de `firebaseConfig` por la configuración de la app web nueva. No borres las comillas ni cambies los nombres de las propiedades.
6. Actualizá `.firebaserc` para que `default` tenga el ID del proyecto nuevo.
7. Publicá las reglas de este proyecto siguiendo el paso 6 de la guía.

La configuración web identifica el proyecto de Firebase y está pensada para usarse en una app cliente; no es una clave de administrador. No agregues claves privadas de cuentas de servicio a estos archivos. Las reglas de Firestore son las que autorizan el acceso a los datos.

## 6. Publicar o revisar las reglas de Firestore

Las reglas están en `firestore.rules`. Ya se publicaron en el proyecto Firebase conectado. Si las editás, mantené la copia local y la publicada sincronizadas.

### Desde Firebase Console

1. Abrí el proyecto elegido y entrá en **Firestore Database → Rules**.
2. Reemplazá el contenido del editor por el contenido de `firestore.rules`.
3. Revisá el cambio y presioná **Publish**.

La [documentación oficial de reglas de Firestore](https://firebase.google.com/docs/firestore/security/get-started) explica las reglas y su publicación.

### Opcional: publicar desde la terminal

Para este método necesitás instalar Firebase CLI y autenticarte. Firebase CLI necesita Node.js 18 o posterior, según su [documentación oficial](https://firebase.google.com/docs/cli).

```powershell
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

El archivo `.firebaserc` selecciona `gymtool-saas` por defecto. Si conectaste un proyecto diferente, cambiá su ID antes de publicar. El despliegue con CLI reemplaza en Firebase las reglas actuales por las que están en el archivo local; no lo ejecutes si no querés reemplazarlas.

## 7. Dónde cambiar cada cosa

- Logo: reemplazá `assets/gymtool-logo.png` por otra imagen con el mismo nombre.
- Colores y apariencia: editá `styles.css`; las pantallas de acceso usan `auth.css`.
- Textos, formularios, saludo y comportamiento: editá `app.js`.
- Estructura general, botones de navegación y títulos: editá `index.html`.
- Proyecto Firebase: editá `firebase-config.js` y `.firebaserc`.
- Accesos a datos: editá `firestore.rules`.
- Puerto del servidor local: `server.mjs` usa `4173` por defecto. Si necesitás otro, podés definir la variable `PORT` antes de iniciarlo.

El tema claro/oscuro se cambia desde el botón con la luna o el sol en la interfaz y la preferencia queda guardada en el navegador donde la seleccionaste.

## 8. Datos y límites actuales

Los datos de cada gimnasio están en colecciones separadas bajo `gyms/{gymId}`. Authentication administra las cuentas de acceso; Firestore guarda el perfil, los gimnasios y sus socios, membresías, clases, pagos y asistencias. Los paneles escuchan cambios en Firestore en tiempo real.

Esta versión es una base funcional para aprender y seguir construyendo. El registro automático crea titulares, pero todavía no hay un flujo de invitación de personal. Los pagos se cargan manualmente: no se cobran tarjetas ni se emiten facturas. Antes de venderlo como SaaS, faltan revisión profesional de seguridad, pruebas de reglas y aislamiento entre gimnasios, copias de seguridad, monitoreo, condiciones de privacidad, y preparar una publicación web con dominio y despliegue. El servidor `server.mjs` solo sirve la app en tu propia computadora; no publica la aplicación en internet.

## Archivos del proyecto

```text
GymTool/
├── assets/gymtool-logo.png
├── app.js
├── auth.css
├── firebase-config.js
├── firebase.js
├── firebase.json
├── firestore.rules
├── index.html
├── package.json
├── server.mjs
├── styles.css
├── .firebaserc
├── README.md
└── GUIA-INICIO.md
```
