# Configuración de Firebase, Google Drive, Cloudinary y Vercel

La tienda usa Firebase Authentication para el acceso privado, Cloud Firestore para el catálogo y Google Drive para las nuevas fotos. Las funciones de carga y borrado se ejecutan en Vercel. Las fotos que ya estaban en Cloudinary siguen siendo compatibles.

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

La API de Vercel verifica el token de Firebase y comprueba el documento `admins/{UID}` antes de permitir operaciones administrativas.

1. En Google Cloud Console, creá una cuenta de servicio dedicada para la API de fotos.
2. Asignale los roles **Cloud Datastore Viewer** y **Firebase Authentication Viewer** para que pueda comprobar el documento de administrador y validar que la sesión no fue revocada.
3. Creá y descargá una clave JSON de esa cuenta. No la subas al repositorio ni la compartas por chat.
4. En Vercel, agregá estas variables de entorno usando los valores del proyecto y de esa clave:

   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`

`FIREBASE_PRIVATE_KEY` es la clave privada del JSON. Pegala como valor completo en Vercel; mantenela como variable de servidor y nunca le agregues el prefijo `VITE_`.

## 3. Preparar Google Drive

La API guarda las fotos con una cuenta Google autorizada mediante OAuth. Las imágenes se comparten públicamente para que aparezcan en el catálogo; usá una cuenta dedicada si no querés mezclar estos archivos con tu Drive personal. La primera carga crea automáticamente `MR_Celulares` y, dentro, una subcarpeta por ID de producto. Las carpetas y fotos creadas por la API quedan identificadas para que solo se borren archivos pertenecientes a esta aplicación.

1. En Google Cloud Console, habilitá **Google Drive API** y configurá la pantalla de consentimiento OAuth.
2. Creá un cliente OAuth de tipo **Web application**. Si vas a usar OAuth Playground para generar el permiso inicial, agregá `https://developers.google.com/oauthplayground` como URI de redirección autorizada.
3. En OAuth Playground, abrí la configuración, activá **Use your own OAuth credentials** e ingresá el ID y el secreto del cliente. Solicitá el alcance `https://www.googleapis.com/auth/drive.file`, autorizá la cuenta que guardará las fotos e intercambiá el código por tokens.
4. Copiá el **refresh token** resultante. Guardá el ID, el secreto y el refresh token en Vercel como variables de servidor:

   - `GOOGLE_DRIVE_CLIENT_ID`
   - `GOOGLE_DRIVE_CLIENT_SECRET`
   - `GOOGLE_DRIVE_REFRESH_TOKEN`

No uses una app OAuth externa que siga en estado **Testing** para producción: Google puede hacer vencer sus refresh tokens de prueba a los 7 días. La cuenta autorizada debe permitir compartir archivos públicamente; cada foto nueva quedará visible para cualquiera que tenga el enlace y la API la usará en el catálogo.

El alcance `drive.file` permite a la aplicación administrar los archivos y carpetas que ella misma crea. Si ya tenés una carpeta `MR_Celulares` creada manualmente, no se asume que OAuth pueda acceder a ella: la aplicación puede crear su propia carpeta con ese nombre.

Las cargas están limitadas a **4 MB** para respetar el tamaño máximo de solicitud de las funciones de Vercel. El servidor valida tanto el tipo MIME declarado como la firma del contenido de la foto.

## 4. Mantener compatibilidad con fotos anteriores de Cloudinary

Las variables de Cloudinary solo son necesarias para reemplazar o borrar fotos antiguas que tengan `photoStorage: "cloudinary"`:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

El API Secret debe permanecer solo en el servidor. Las fotos nuevas ya no se suben a Cloudinary.

## 5. Configurar y publicar en Vercel

En **Settings → Environment Variables**, agregá las variables del servidor indicadas arriba y las variables públicas de Firebase:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Aplicalas a los entornos que uses (**Production**, **Preview** y/o **Development**) y volvé a desplegar. Las funciones de `api/` requieren Vercel; una publicación estática en GitHub Pages no puede ejecutar estas funciones.

Para producción, el sitio debe abrirse desde el dominio asignado a Vercel, ya que el navegador llama a `/api/...` en el mismo origen. El workflow `.github/workflows/deploy-pages.yml` publica una copia estática en GitHub Pages; esa copia no puede cargar ni borrar fotos mediante las funciones de Vercel.

Para desarrollo local, guardá las mismas variables en el archivo `.env` local, que está excluido de Git, y ejecutá las funciones con `npx vercel dev`. `npm run dev` solo ejecuta Vite y no inicia las funciones de Vercel.
