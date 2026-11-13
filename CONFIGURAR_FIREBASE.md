# Configuración de acceso y publicación

Los clientes ven el catálogo público de celulares y accesorios. La edición de productos, las fotos, la gestión de ventas y las boletas solo aparecen para una cuenta administradora autorizada.

## 1. Preparar Firebase

En el proyecto Firebase que corresponde a las variables `VITE_FIREBASE_*` del archivo `.env`:

1. En **Authentication → Sign-in method**, habilitá **Correo electrónico/contraseña**.
2. En **Authentication → Users**, creá tu usuario administrador. No hay registro público desde el sitio.
3. Creá la base de datos de **Cloud Firestore** y habilitá **Storage**.
4. Copiá el UID de tu usuario. En Firestore, creá el documento `admins/{UID}` (el UID como ID del documento), por ejemplo con el campo `role: "admin"`. Las reglas impiden crear o modificar administradores desde el sitio.
5. Desde la raíz del proyecto, iniciá sesión con Firebase CLI y publicá las reglas:

   ```sh
   npx firebase-tools login
   npx firebase-tools deploy --project ID_DEL_PROYECTO --only firestore:rules,storage
   ```

El catálogo se comparte entre todos los visitantes mediante Cloud Firestore. Las reglas permiten que cualquier visitante lea productos, pero solo el UID guardado en `admins/{UID}` puede modificarlos. Los comprobantes permanecen privados para administradores.

## 2. Publicar en GitHub Pages

En **Settings → Secrets and variables → Actions → Variables**, creá estas seis variables con los valores de la aplicación web de Firebase: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID` y `VITE_FIREBASE_APP_ID`.

En **Settings → Pages**, elegí **GitHub Actions** como origen. Luego de subir los cambios a `main`, el flujo de Actions compila y publica el sitio.

Para probarlo localmente, instalá dependencias con `npm install` y ejecutá `npm run dev`. El archivo `.env` local no se publica en Git.
