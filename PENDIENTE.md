# Cosas pendientes que tienes que hacer tú

Lo que no se puede hacer desde Claude (cuentas y contraseñas tuyas). Cuando hagas algo, avisa
para que lo compruebe y lo tache.

## 1. Clave de firma de la APK (para actualizar sin desinstalar)

Sin ella cada APK se firma con una clave distinta y hay que desinstalar la anterior para
instalar la nueva (se pierde lo que no esté subido a GitHub).

1. En tu ordenador, crea la clave (te pedirá una contraseña: apúntala):

   ```bash
   keytool -genkeypair -keystore dnd-helper.keystore -alias dndhelper -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Conviértela a texto:

   ```bash
   base64 -w0 dnd-helper.keystore
   ```

3. En GitHub: repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `ANDROID_KEYSTORE_BASE64`: el texto del paso 2
   - `ANDROID_KEYSTORE_PASSWORD`: la contraseña
   - `ANDROID_KEY_ALIAS`: `dndhelper`
4. Guarda `dnd-helper.keystore` en un sitio seguro (no lo subas al repo).

La primera APK firmada con esta clave aún pide desinstalar la anterior; a partir de ahí, las
actualizaciones se instalan encima.

## 2. Cuenta de Cloudflare (imágenes de las especies con IA, gratis)

Las imágenes se generan con Cloudflare Workers AI (modelo FLUX.1 schnell), gratis hasta unas
230 imágenes al día.

1. Crea una cuenta gratuita en <https://dash.cloudflare.com/sign-up>.
2. Copia tu **Account ID** (aparece en el panel, en la columna de la derecha de
   "Workers & Pages" o en la URL del panel).
3. Crea un **API token**: My Profile → API Tokens → Create Token → plantilla **"Workers AI"**
   (o un token personalizado con el permiso *Account → Workers AI → Read/Edit*).
4. En GitHub: repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `CLOUDFLARE_ACCOUNT_ID`: el Account ID
   - `CLOUDFLARE_API_TOKEN`: el token
5. Avisa: se lanzará primero una prueba con 3–4 especies para que apruebes el estilo.
