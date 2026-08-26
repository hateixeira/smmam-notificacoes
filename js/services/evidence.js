import { deleteObject, getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function dataUrlToBlob(dataUrl) {
  const [header, encoded] = String(dataUrl).split(",");
  const mime = header.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(encoded ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

function safeFilename(value) {
  return String(value || "evidencia.jpg").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

export async function uploadEvidence(storage, { sector, documentId, localEvidence }) {
  const blob = localEvidence.blob ?? dataUrlToBlob(localEvidence.previewUrl);
  if (blob.size > MAX_IMAGE_BYTES) throw new Error("A evidência excede o limite de 5 MB.");
  if (!blob.type.startsWith("image/")) throw new Error("Somente imagens podem ser anexadas como evidência.");
  const id = crypto.randomUUID();
  const path = `evidencias/${sector}/${documentId}/${id}-${safeFilename(localEvidence.name)}`;
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, blob, { contentType: blob.type, customMetadata: { documentId, sector } });
  return {
    storagePath: snapshot.ref.fullPath,
    downloadUrl: await getDownloadURL(snapshot.ref),
    nomeArquivo: safeFilename(localEvidence.name),
    contentType: blob.type,
    tamanhoBytes: blob.size,
  };
}

export async function deleteEvidence(storage, storagePath) {
  if (!storagePath) return;
  await deleteObject(ref(storage, storagePath));
}
