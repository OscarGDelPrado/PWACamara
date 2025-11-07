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

let stream = null;
let lastPhotoDataURL = null;

async function openCamera() {
  try {
    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },
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

function takePhoto() {
  if (!stream) {
    alert('Primero debes abrir la cámara');
    return;
  }

  // Dibujar el frame actual del video en el canvas
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

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