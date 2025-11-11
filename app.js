// Referencias a elementos del DOM
const openCameraBtn = document.getElementById('openCamera');
const cameraContainer = document.getElementById('cameraContainer');
const video = document.getElementById('video');
const takePhotoBtn = document.getElementById('takePhoto');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const downloadPhotoBtn = document.getElementById('downloadPhoto');
const photoPreview = document.getElementById('photoPreview');
const photoPreviewContainer = document.getElementById('photoPreviewContainer');
const switchCameraBtn = document.getElementById('switchCamera');
// Galería
const galleryContainer = document.getElementById('galleryContainer');
const galleryImage = document.getElementById('galleryImage');
const prevPhotoBtn = document.getElementById('prevPhoto');
const nextPhotoBtn = document.getElementById('nextPhoto');
const clearGalleryBtn = document.getElementById('clearGallery');

let stream = null;
let lastPhotoDataURL = null;
let currentFacingMode = 'environment'; // 'environment' (trasera) o 'user' (frontal)

// Estado de galería
let galleryPhotos = []; // {id: number, dataURL: string}
let currentPhotoIndex = -1;

// IndexedDB utilidades básicas
const DB_NAME = 'pwa-camara';
const STORE_NAME = 'photos';
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function savePhotoToDB(dataURL) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id: Date.now(), dataURL });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function loadPhotosFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => a.id - b.id));
    req.onerror = () => reject(req.error);
  });
}
async function clearPhotosFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function renderGallery() {
  if (!galleryContainer || !galleryImage) return;
  if (galleryPhotos.length === 0) {
    galleryContainer.style.display = 'none';
    currentPhotoIndex = -1;
    return;
  }
  galleryContainer.style.display = 'block';
  // Asegurar límites
  if (currentPhotoIndex < 0) currentPhotoIndex = 0;
  if (currentPhotoIndex >= galleryPhotos.length) currentPhotoIndex = galleryPhotos.length - 1;
  const current = galleryPhotos[currentPhotoIndex];
  galleryImage.src = current.dataURL;
  // Habilitar/Deshabilitar navegación
  if (prevPhotoBtn) prevPhotoBtn.disabled = currentPhotoIndex <= 0;
  if (nextPhotoBtn) nextPhotoBtn.disabled = currentPhotoIndex >= galleryPhotos.length - 1;
}

async function initGallery() {
  try {
    galleryPhotos = await loadPhotosFromDB();
    currentPhotoIndex = galleryPhotos.length - 1;
    renderGallery();
  } catch (e) {
    console.error('Error cargando galería:', e);
  }
}

async function openCamera() {
  try {
    const constraints = {
      video: {
        facingMode: { ideal: currentFacingMode },
        width: { ideal: 320 },
        height: { ideal: 240 }
      },
      audio: false
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;

    // Asegurar dimensiones del canvas según el stream
    await new Promise(resolve => {
      if (video.readyState >= 2) return resolve();
      video.onloadedmetadata = () => resolve();
    });
    const w = video.videoWidth || 320;
    const h = video.videoHeight || 240;
    canvas.width = w;
    canvas.height = h;

    // Activar/Desactivar modo espejo en vista previa de video según cámara frontal
    video.classList.toggle('mirror', currentFacingMode === 'user');

    cameraContainer.style.display = 'block';
    cameraContainer.setAttribute('aria-hidden', 'false');
    openCameraBtn.textContent = 'Cámara abierta';
    openCameraBtn.disabled = true;
    downloadPhotoBtn.style.display = 'none';
    canvas.style.display = 'none';
    video.style.display = 'block';

    console.log('Cámara abierta exitosamente');
  } catch (error) {
    console.error('Error al acceder a la cámara:', error);
    alert('No se pudo acceder a la cámara. Revisa los permisos y el contexto (HTTPS/localhost).');
  }
}

function switchCamera() {
  // Alternar modo de cámara
  currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
  // Si hay stream activo, detenerlo antes de reiniciar
  try {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
  } catch (e) {
    console.warn('Al detener el stream para cambiar cámara:', e);
  }

  // Reabrir la cámara con el nuevo modo
  openCamera();
}

function takePhoto() {
  if (!stream) {
    alert('Primero debes abrir la cámara');
    return;
  }

  // Dibujar el frame actual del video en el canvas
  // Si es cámara frontal, aplicamos espejo en el canvas para que coincida con la vista
  ctx.save();
  if (currentFacingMode === 'user') {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  // Convertir a base64 PNG
  lastPhotoDataURL = canvas.toDataURL('image/png');
  console.log('Foto capturada en base64:', lastPhotoDataURL.length, 'caracteres');

  // Mostrar canvas y botón de descarga
  canvas.style.display = 'block';
  downloadPhotoBtn.style.display = 'inline-block';

  // Actualizar previsualización persistente debajo
  if (photoPreview) {
    photoPreview.src = lastPhotoDataURL;
  }
  if (photoPreviewContainer) {
    photoPreviewContainer.style.display = 'block';
  }

  // Guardar en galería persistente y mostrar
  savePhotoToDB(lastPhotoDataURL)
    .then(async () => {
      galleryPhotos = await loadPhotosFromDB();
      currentPhotoIndex = galleryPhotos.length - 1; // última foto
      renderGallery();
    })
    .catch(e => console.error('Error guardando en galería:', e));

  // Cerrar la cámara después de capturar (como sugiere la guía)
  closeCamera();
}

function closeCamera() {
  try {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
  } catch (e) {
    console.warn('Al cerrar la cámara sucedió:', e);
  }
  video.srcObject = null;
  video.classList.remove('mirror');
  stream = null;
  openCameraBtn.textContent = 'Abrir cámara';
  openCameraBtn.disabled = false;
  // Mantener visible el canvas si ya hay una foto capturada
  if (lastPhotoDataURL) {
    cameraContainer.style.display = 'block';
    cameraContainer.setAttribute('aria-hidden', 'false');
    video.style.display = 'none';
    canvas.style.display = 'block';
    downloadPhotoBtn.style.display = 'inline-block';
  } else {
    cameraContainer.style.display = 'none';
    cameraContainer.setAttribute('aria-hidden', 'true');
  }
}

function downloadPhoto() {
  if (!lastPhotoDataURL) {
    alert('No hay foto capturada aún');
    return;
  }
  const a = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = lastPhotoDataURL;
  a.download = `foto-${ts}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Eventos
openCameraBtn.addEventListener('click', openCamera);
takePhotoBtn.addEventListener('click', takePhoto);
downloadPhotoBtn.addEventListener('click', downloadPhoto);
switchCameraBtn.addEventListener('click', switchCamera);

// Navegación galería
if (prevPhotoBtn) {
  prevPhotoBtn.addEventListener('click', () => {
    if (currentPhotoIndex > 0) {
      currentPhotoIndex -= 1;
      renderGallery();
    }
  });
}
if (nextPhotoBtn) {
  nextPhotoBtn.addEventListener('click', () => {
    if (currentPhotoIndex < galleryPhotos.length - 1) {
      currentPhotoIndex += 1;
      renderGallery();
    }
  });
}
if (clearGalleryBtn) {
  clearGalleryBtn.addEventListener('click', async () => {
    const ok = confirm('¿Deseas borrar todas las fotos de la galería?');
    if (!ok) return;
    try {
      await clearPhotosFromDB();
      galleryPhotos = [];
      currentPhotoIndex = -1;
      renderGallery();
    } catch (e) {
      console.error('Error al limpiar la galería:', e);
      alert('No se pudo limpiar la galería.');
    }
  });
}

// Inicializar galería al cargar
initGallery();