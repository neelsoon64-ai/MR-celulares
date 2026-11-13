# Configuración de Firebase, Cloudinary y Vercel

La tienda usa Firebase Authentication para el acceso privado, Cloud Firestore para el catálogo y Cloudinary para las fotos. Las funciones de firma y borrado de fotos se ejecutan en Vercel; no se usa Firebase Storage para las nuevas cargas.

## 1. Preparar Firebase

En el proyecto Firebase correspondiente a las variables `VITE_FIREBASE_*`:

1. En **Authentication → Sign-in method**, habilitá **Correo electrónico/contraseña**.
2. En **Authentication → Users**, creá la cuenta administradora. El sitio no permite registros públicos.
3. Creá la base de datos de **Cloud Firestore**.
4. Copiá el UID de la cuenta y, en Firestore, creá el documento `admins/{UID}` (el UID como ID del documento). Puede incluir `role: "admin"`. Las reglas impiden crear o modificar administradores desde el sitio.
5. Publicá las reglas de Firestore:

   ```sh
   npx firebase-tools login
   npx firebase-tools deploy --project ID_DEL_PROYECTO --only firestore:rules
   ```

Las reglas permiten leer el catálogo públicamente, pero solo el UID de `admins/{UID}` puede modificarlo. Los comprobantes permanecen privados.

## 2. Preparar las credenciales de servidor

La API de Vercel verifica el token de Firebase y comprueba el documento `admins/{UID}` antes de firmar cargas o borrar fotos.

1. En Google Cloud Console, creá una cuenta de servicio dedicada para la API de fotos.
2. Asignale los roles **Cloud Datastore Viewer** y **Firebase Authentication Viewer** para que pueda comprobar el documento de administrador y validar que la sesión no fue revocada.
3. Creá y descargá una clave JSON de esa cuenta. No la subas al repositorio ni la compartas por chat.
4. En Vercel, agregá estas variables de entorno usando los valores del proyecto y de esa clave:

   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`

`FIREBASE_PRIVATE_KEY` es la clave privada del JSON. Pegala como valor completo en Vercel; mantenela como variable de servidor y nunca le agregues el prefijo `VITE_`.

## 3. Preparar Cloudinary

En el panel de Cloudinary, obtené el **Cloud name**, **API Key** y **API Secret**. En Vercel, agregá:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

El API Secret debe permanecer solo en el servidor; nunca lo pongas en una variable `VITE_*` ni en el código del navegador. La app usa cargas firmadas, por lo que no hace falta habilitar un preset de carga sin firma.

## 4. Configurar y publicar en Vercel

En **Settings → Environment Variables**, agregá las variables anteriores y las variables públicas de Firebase:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Aplicalas a los entornos que uses (**Production**, **Preview** y/o **Development**) y volvé a desplegar. Las funciones de `api/` requieren Vercel; una publicación estática en GitHub Pages no puede ejecutar estas funciones.

Para desarrollo local, guardá las mismas variables en el archivo `.env` local, que está excluido de Git, y ejecutá las funciones con `npx vercel dev`. `npm run dev` solo ejecuta Vite y no inicia las funciones de Vercel.
