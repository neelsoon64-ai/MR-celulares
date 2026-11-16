# Configuración de Firebase, Google Drive, Cloudinary y Vercel

La tienda usa Firebase Authentication para el acceso privado, Cloud Firestore para el catálogo y Google Drive para las nuevas fotos. Las funciones de carga y borrado de Drive se ejecutan en Firebase Functions. Las fotos que ya estaban en Cloudinary siguen siendo compatibles y su borrado todavía usa una función de Vercel.

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

## 2. Preparar permisos de Firebase Functions

Las funciones verifican el token de Firebase y comprueban el documento `admins/{UID}` antes de permitir operaciones de fotos. En Firebase Functions se usa la identidad de ejecución de Google Cloud; no descargues ni subas una clave JSON de cuenta de servicio.

1. En Google Cloud Console → **IAM y administración → IAM**, identificá la cuenta de servicio configurada como identidad de ejecución de las funciones.
2. Asignale los roles **Cloud Datastore Viewer** y **Firebase Authentication Viewer** para que pueda comprobar el documento de administrador y validar que la sesión no fue revocada.

El proyecto debe tener habilitada la facturación de Firebase (**plan Blaze**) para desplegar funciones.

La función de borrado de Cloudinary que se conserva para fotos antiguas sigue en Vercel y usa `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY`. Mantenelas como variables de servidor de Vercel mientras haya productos con `photoStorage: "cloudinary"`.

## 3. Preparar Google Drive

La API guarda las fotos con una cuenta Google autorizada mediante OAuth. Las imágenes se comparten públicamente para que aparezcan en el catálogo; usá una cuenta dedicada si no querés mezclar estos archivos con tu Drive personal. La primera carga crea automáticamente `MR_Celulares` y, dentro, una subcarpeta por ID de producto. Las carpetas y fotos creadas por la API quedan identificadas para que solo se borren archivos pertenecientes a esta aplicación.

1. En Google Cloud Console, habilitá **Google Drive API** y configurá la pantalla de consentimiento OAuth.
2. Creá un cliente OAuth de tipo **Web application**. Si vas a usar OAuth Playground para generar el permiso inicial, agregá `https://developers.google.com/oauthplayground` como URI de redirección autorizada.
3. En OAuth Playground, abrí la configuración, activá **Use your own OAuth credentials** e ingresá el ID y el secreto del cliente. Solicitá el alcance `https://www.googleapis.com/auth/drive.file`, autorizá la cuenta que guardará las fotos e intercambiá el código por tokens.
4. Copiá el **refresh token** resultante. Guardá el ID, el secreto y el refresh token en Firebase Secret Manager mediante Firebase CLI:

   ```sh
   npx firebase-tools functions:secrets:set GOOGLE_DRIVE_CLIENT_ID
   npx firebase-tools functions:secrets:set GOOGLE_DRIVE_CLIENT_SECRET
   npx firebase-tools functions:secrets:set GOOGLE_DRIVE_REFRESH_TOKEN
   ```

   Ingresá cada valor cuando la CLI lo solicite; no los guardes en el repositorio ni en variables `VITE_*`.

No uses una app OAuth externa que siga en estado **Testing** para producción: Google puede hacer vencer sus refresh tokens de prueba a los 7 días. La cuenta autorizada debe permitir compartir archivos públicamente; cada foto nueva quedará visible para cualquiera que tenga el enlace y la API la usará en el catálogo.

El alcance `drive.file` permite a la aplicación administrar los archivos y carpetas que ella misma crea. Si ya tenés una carpeta `MR_Celulares` creada manualmente, no se asume que OAuth pueda acceder a ella: la aplicación puede crear su propia carpeta con ese nombre.

Las cargas están limitadas a **4 MB**. El servidor valida tanto el tipo MIME declarado como la firma del contenido de la foto. Las funciones HTTP se despliegan en `us-central1` y el frontend las llama directamente; CORS está habilitado y cada operación exige un token Firebase válido de administrador.

## 4. Mantener compatibilidad con fotos anteriores de Cloudinary

Las variables de Cloudinary solo son necesarias para borrar fotos antiguas que tengan `photoStorage: "cloudinary"`:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

El API Secret debe permanecer solo en el servidor. Las fotos nuevas ya no se suben a Cloudinary.

## 5. Desplegar las funciones y publicar el sitio

Desplegá las funciones de Drive después de configurar los secretos:

```sh
npx firebase-tools deploy --only functions:uploadGoogleDrivePhoto,functions:deleteGoogleDrivePhoto
```

El frontend debe construirse con las variables públicas de Firebase:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Configurá esas variables donde se construya el frontend (**Production**, **Preview** y/o **Development**) y volvé a desplegarlo. El frontend llama directamente a Firebase Functions para las fotos de Drive, por lo que también puede servirse desde GitHub Pages. El borrado de fotos antiguas de Cloudinary sigue llamando a `/api/cloudinary-delete` y requiere que esa ruta de Vercel esté disponible.

Para desarrollo local, `npm run dev` inicia Vite y usa el mismo endpoint de Firebase Functions. El borrado de fotos antiguas de Cloudinary requiere además ejecutar las funciones de Vercel con `npx vercel dev`.
