import { randomUUID } from "node:crypto";
import { ApiError } from "./api-utils.js";

export class GoogleDriveApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function getOAuthCredentials() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Drive OAuth server credentials are not configured.");
  }

  return { clientId, clientSecret, refreshToken };
}

async function getAccessToken() {
  const credentials = getOAuthCredentials();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: "refresh_token"
    })
  });
  const result = await response.json();

  if (!response.ok) {
    throw new GoogleDriveApiError(
      response.status,
      `Google OAuth token request failed: ${result.error_description || result.error || response.statusText}`
    );
  }
  if (typeof result.access_token !== "string" || !result.access_token) {
    throw new Error("Google OAuth did not return an access token.");
  }

  return result.access_token;
}

async function driveRequest(accessToken, url, options = {}) {
  const { headers = {}, ...requestOptions } = options;
  const response = await fetch(url, {
    ...requestOptions,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...headers
    }
  });

  if (!response.ok) {
    const details = await response.text();
    throw new GoogleDriveApiError(
      response.status,
      `Google Drive API request failed (${response.status}): ${details}`
    );
  }
  if (response.status === 204) return null;

  return response.json();
}

async function findDriveFolder(accessToken, query) {
  const params = new URLSearchParams({
    q: `${query} and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id,name)",
    pageSize: "1",
    spaces: "drive"
  });
  const result = await driveRequest(
    accessToken,
    `https://www.googleapis.com/drive/v3/files?${params}`
  );
  return result.files?.[0] || null;
}

async function createDriveFolder(accessToken, name, appProperties, parents = []) {
  const folder = await driveRequest(
    accessToken,
    "https://www.googleapis.com/drive/v3/files?fields=id",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        appProperties,
        ...(parents.length ? { parents } : {})
      })
    }
  );
  if (typeof folder?.id !== "string" || !folder.id) {
    throw new Error("Google Drive did not return the created folder ID.");
  }
  return folder.id;
}

async function getProductFolderId(accessToken, productId) {
  const appPropertyQuery =
    "appProperties has { key='application' and value='mr-celulares' }";
  const rootFolder = await findDriveFolder(
    accessToken,
    `${appPropertyQuery} and appProperties has { key='folderType' and value='root' }`
  );
  const rootFolderId = rootFolder?.id || await createDriveFolder(
    accessToken,
    "MR_Celulares",
    { application: "mr-celulares", folderType: "root" }
  );
  const productFolder = await findDriveFolder(
    accessToken,
    `${appPropertyQuery} and appProperties has { key='folderType' and value='product' }`
      + ` and appProperties has { key='productId' and value='${productId}' }`
      + ` and '${rootFolderId}' in parents`
  );
  return productFolder?.id || createDriveFolder(
    accessToken,
    productId,
    { application: "mr-celulares", folderType: "product", productId },
    [rootFolderId]
  );
}

export async function uploadGoogleDriveImage(file, productId, contentType) {
  const accessToken = await getAccessToken();
  const productFolderId = await getProductFolderId(accessToken, productId);
  const extension = contentType.split("/")[1];
  const boundary = `mr-celulares-${randomUUID()}`;
  const metadata = {
    name: `${productId}-${randomUUID()}.${extension}`,
    mimeType: contentType,
    appProperties: {
      application: "mr-celulares",
      productId
    },
    parents: [productFolderId]
  };
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`
    ),
    file,
    Buffer.from(`\r\n--${boundary}--`)
  ]);
  const uploaded = await driveRequest(
    accessToken,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body
    }
  );

  if (typeof uploaded?.id !== "string" || !uploaded.id) {
    throw new Error("Google Drive did not return the uploaded file ID.");
  }

  try {
    await driveRequest(
      accessToken,
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(uploaded.id)}/permissions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "anyone", role: "reader" })
      }
    );
  } catch (error) {
    try {
      await driveRequest(
        accessToken,
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(uploaded.id)}`,
        { method: "DELETE" }
      );
    } catch (cleanupError) {
      console.error("Could not remove a Drive upload after sharing failed", cleanupError);
    }
    throw error;
  }

  return {
    fileId: uploaded.id,
    photoUrl: `https://drive.google.com/uc?export=view&id=${encodeURIComponent(uploaded.id)}`
  };
}

export async function deleteGoogleDriveImage(fileId, productId) {
  const accessToken = await getAccessToken();
  const encodedId = encodeURIComponent(fileId);
  let file;

  try {
    file = await driveRequest(
      accessToken,
      `https://www.googleapis.com/drive/v3/files/${encodedId}?fields=id%2CappProperties`
    );
  } catch (error) {
    if (error instanceof GoogleDriveApiError && error.status === 404) return false;
    throw error;
  }

  if (
    file.appProperties?.application !== "mr-celulares"
    || file.appProperties?.productId !== productId
  ) {
    throw new ApiError(404, "La foto no existe en la cuenta de Google Drive.");
  }

  await driveRequest(accessToken, `https://www.googleapis.com/drive/v3/files/${encodedId}`, {
    method: "DELETE"
  });
  return true;
}
