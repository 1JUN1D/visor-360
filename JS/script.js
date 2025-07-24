// script.js - Script principal actualizado con integración de red neuronal

let viewer;
let isVideo = false;
let gpxData = null;
let videoStartTime = null;
const fileCoordinates = new Map();
const fileGpxData = new Map();

// Inicialización del sistema
document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar el analizador de fachadas
    const modelStatus = document.getElementById('modelStatus');
    if (modelStatus) {
        modelStatus.style.display = 'block';
    }

    try {
        const initialized = await window.facadeAnalyzer.initialize();
        if (initialized) {
            console.log('Sistema de análisis inicializado correctamente');
            setTimeout(() => {
                if (modelStatus) {
                    modelStatus.style.display = 'none';
                }
            }, 2000);
        }
    } catch (error) {
        console.error('Error inicializando el sistema:', error);
        if (modelStatus) {
            modelStatus.innerHTML = '<p style="color: #e74c3c;">Error cargando modelos. Recargue la página.</p>';
        }
    }
});

// Función para leer metadatos EXIF
async function getImageLocation(file) {
    try {
        const tags = await ExifReader.load(file);
        if (tags.GPSLatitude && tags.GPSLongitude) {
            return {
                lat: tags.GPSLatitude.description,
                lon: tags.GPSLongitude.description
            };
        }
        return null;
    } catch (error) {
        console.error("Error leyendo EXIF:", error);
        return null;
    }
}

// Función para procesar archivo GPX
async function processGpxFile() {
    const file = document.getElementById('gpxFile').files[0];
    if (!file) return;

    const text = await file.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");

    gpxData = Array.from(xmlDoc.getElementsByTagName('trkpt')).map(point => ({
        lat: parseFloat(point.getAttribute('lat')),
        lon: parseFloat(point.getAttribute('lon')),
        time: new Date(point.getElementsByTagName('time')[0].textContent).getTime()
    }));

    gpxData.sort((a, b) => a.time - b.time);
    videoStartTime = gpxData[0].time;

    const currentFile = document.querySelector('.thumbnail.active').dataset.fileUrl;
    fileGpxData.set(currentFile, gpxData);

    updatePlanPluginPosition(gpxData[0].lat, gpxData[0].lon);
    syncPlanPluginWithVideo();
}

// Función para obtener coordenadas en un tiempo específico
window.getCurrentCoordinatesForTime = function(timeInSeconds) {
    if (!gpxData || !videoStartTime) return null;
    
    const currentTimeMs = timeInSeconds * 1000;
    let closestPoint = null;
    let minDiff = Infinity;

    for (const point of gpxData) {
        const timeDiff = Math.abs(point.time - videoStartTime - currentTimeMs);
        if (timeDiff < minDiff) {
            minDiff = timeDiff;
            closestPoint = point;
        }
    }

    return closestPoint ? { lat: closestPoint.lat, lon: closestPoint.lon } : null;
};

function updateCoordinates() {
    const lat = parseFloat(document.getElementById('latInput').value);
    const lon = parseFloat(document.getElementById('lonInput').value);
    if (!isNaN(lat) && !isNaN(lon)) {
        updatePlanPluginPosition(lat, lon);
        const currentFile = document.querySelector('.thumbnail.active').dataset.fileUrl;
        fileCoordinates.set(currentFile, { lat, lon });
    }
}

function updatePlanPluginPosition(lat, lon) {
    const planPlugin = viewer.getPlugin(PhotoSphereViewer.PlanPlugin);
    if (planPlugin) {
        planPlugin.setHotspots([
            {
                id: 'current-position',
                coordinates: [lon, lat],
                tooltip: 'Posición Actual',
                color: 'red'
            }
        ]);
        planPlugin.setCoordinates([lon, lat]);
    } else {
        console.error('PlanPlugin no está disponible.');
    }
}

function syncPlanPluginWithVideo() {
    const videoAdapter = viewer.adapter;
    if (videoAdapter && videoAdapter.video && gpxData) {
        const videoElement = videoAdapter.video;
        videoElement.addEventListener('timeupdate', () => {
            const currentTimeMs = videoElement.currentTime * 1000;
            const closestPoint = findClosestGpxPoint(currentTimeMs);

            if (closestPoint) {
                updatePlanPluginPosition(closestPoint.lat, closestPoint.lon);
            }
        });
    } else {
        console.error("No se pudo sincronizar el video.");
    }
}

function findClosestGpxPoint(currentTimeMs) {
    let closestPoint = null;
    let minDiff = Infinity;

    for (const point of gpxData) {
        const timeDiff = Math.abs(point.time - videoStartTime - currentTimeMs);
        if (timeDiff < minDiff) {
            minDiff = timeDiff;
            closestPoint = point;
        }
    }

    return closestPoint;
}

function initViewer(fileURL, fileType) {
    if (viewer) {
        viewer.destroy();
    }

    const viewerConfig = {
        container: 'viewer',
        touchmoveTwoFingers: true,
        mousewheelCtrlKey: true,
        defaultZoomLvl: 0,
        navbar: ['zoom', 'move', 'fullscreen'],
        panorama: fileURL,
        plugins: [
            [PhotoSphereViewer.PlanPlugin, {
                defaultZoom: 14,
                coordinates: [6.78677, 44.58241],
                size: { width: '300px', height: '200px' },
                position: 'bottom left',
                visibleOnLoad: true,
                layers: [
                    {
                        name: 'OpenStreetMap',
                        urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                        attribution: '&copy; OpenStreetMap'
                    }
                ],
                hotspots: [
                    {
                        coordinates: [6.7783, 44.58506],
                        id: 'location-1',
                        tooltip: 'Ubicación 1',
                        color: 'green'
                    }
                ]
            }]
        ]
    };

    // Limpiar resultados anteriores si hay
    if (window.videoProcessor) {
        window.videoProcessor.clearResults();
    }

    if (fileType.includes("video") || fileType === "insv") {
        isVideo = true;
        document.getElementById('gpxUpload').style.display = 'block';
        document.getElementById('coordinatesInput').style.display = 'none';
        document.getElementById('videoControls').style.display = 'block';
        
        viewerConfig.adapter = PhotoSphereViewer.EquirectangularVideoAdapter;
        viewerConfig.plugins.push([PhotoSphereViewer.VideoPlugin, {
            autoplay: false,
            progressBar: true
        }]);

        if (fileGpxData.has(fileURL)) {
            gpxData = fileGpxData.get(fileURL);
            videoStartTime = gpxData[0].time;
            updatePlanPluginPosition(gpxData[0].lat, gpxData[0].lon);
            syncPlanPluginWithVideo();
        }

        viewerConfig.panorama = {
            type: 'equirectangular',
            source: fileURL
        };
        viewerConfig.navbar = ['video', 'videoTime', 'zoom', 'fullscreen'];
    } else {
        isVideo = false;
        document.getElementById('gpxUpload').style.display = 'none';
        document.getElementById('coordinatesInput').style.display = 'block';
        document.getElementById('videoControls').style.display = 'none';

        if (fileCoordinates.has(fileURL)) {
            const { lat, lon } = fileCoordinates.get(fileURL);
            updatePlanPluginPosition(lat, lon);
            document.getElementById('latInput').value = lat;
            document.getElementById('lonInput').value = lon;
        }

        // Analizar imagen estática automáticamente
        analyzeStaticImage(fileURL);
    }

    viewer = new PhotoSphereViewer.Viewer(viewerConfig);

    viewer.addEventListener('ready', () => {
        triggerAutoUpdate();
        
        // Si es video, inicializar el procesador
        if (isVideo && viewer.adapter && viewer.adapter.video) {
            window.videoProcessor.initialize(viewer.adapter.video);
        }
    });
}

// Analizar imagen estática
async function analyzeStaticImage(imageURL) {
    if (!window.facadeAnalyzer || !window.facadeAnalyzer.modelsLoaded) {
        console.log('Esperando a que los modelos se carguen...');
        setTimeout(() => analyzeStaticImage(imageURL), 1000);
        return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
        try {
            const coordinates = fileCoordinates.get(imageURL) || null;
            const results = await window.facadeAnalyzer.analyzeImage(img, null, coordinates);
            
            // Mostrar resultados en el panel
            displayStaticImageResults(results);
        } catch (error) {
            console.error('Error analizando imagen:', error);
        }
    };
    img.src = imageURL;
}

// Mostrar resultados de imagen estática
function displayStaticImageResults(results) {
    const resultsContainer = document.getElementById('analysisResults');
    resultsContainer.innerHTML = '';
    
    const resultElement = window.facadeAnalyzer.createResultElement(results, 1);
    resultsContainer.appendChild(resultElement);
}

function triggerAutoUpdate() {
    const currentFile = document.querySelector('.thumbnail.active').dataset.fileUrl;

    if (fileGpxData.has(currentFile)) {
        gpxData = fileGpxData.get(currentFile);
        videoStartTime = gpxData[0].time;
        updatePlanPluginPosition(gpxData[0].lat, gpxData[0].lon);
        syncPlanPluginWithVideo();
    } else if (fileCoordinates.has(currentFile)) {
        const { lat, lon } = fileCoordinates.get(currentFile);
        updatePlanPluginPosition(lat, lon);
        document.getElementById('latInput').value = lat;
        document.getElementById('lonInput').value = lon;
    }
}

function createThumbnail(file, fileURL) {
    const thumbnail = document.createElement('div');
    thumbnail.className = 'thumbnail';
    thumbnail.dataset.fileUrl = fileURL;

    const removeBtn = document.createElement('div');
    removeBtn.className = 'remove-btn';
    removeBtn.innerHTML = '✖';
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        thumbnail.remove();
        fileCoordinates.delete(fileURL);
        fileGpxData.delete(fileURL);
        
        // Si es el archivo activo, limpiar el procesador
        if (thumbnail.classList.contains('active') && window.videoProcessor) {
            window.videoProcessor.reset();
        }
        
        if (thumbnailContainer.children.length === 0) {
            viewerContainer.style.display = 'none';
            uploadScreen.style.display = 'flex';
        }
    });

    thumbnail.appendChild(removeBtn);

    if (file.type.includes("video") || file.name.endsWith(".insv")) {
        const video = document.createElement('video');
        video.src = fileURL;
        video.muted = true;
        let attempt = 0;
        const maxAttempts = 5;
        
        const captureFrame = () => {
            if (attempt >= maxAttempts) {
                const img = document.createElement('img');
                img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwIiBoZWlnaHQ9IjkwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxNjAiIGhlaWdodD0iOTAiIGZpbGw9IiNjY2MiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiI+VmlkZW8gMzYwwrA8L3RleHQ+PC9zdmc+';
                thumbnail.appendChild(img);
                video.remove();
                return;
            }
            
            video.currentTime = attempt * 1;
            video.onseeked = function () {
                const canvas = document.createElement('canvas');
                canvas.width = 160;
                canvas.height = 90;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const isBlank = imgData.data.every(pixel => pixel === 0);
                
                if (!isBlank) {
                    const img = document.createElement('img');
                    img.src = canvas.toDataURL();
                    thumbnail.appendChild(img);
                    video.remove();
                } else {
                    attempt++;
                    captureFrame();
                }
            };
        };
        
        video.onloadedmetadata = captureFrame;
    } else {
        const img = document.createElement('img');
        img.src = fileURL;
        img.onerror = function () {
            img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwIiBoZWlnaHQ9IjkwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxNjAiIGhlaWdodD0iOTAiIGZpbGw9IiNjY2MiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiI+SW1hZ2VuIDM2MMKwPC90ZXh0Pjwvc3ZnPg==';
        };
        thumbnail.appendChild(img);
    }

    thumbnail.addEventListener('click', () => {
        document.querySelectorAll('.thumbnail').forEach(thumb => {
            thumb.classList.remove('active');
        });
        thumbnail.classList.add('active');
        initViewer(fileURL, file.type || file.name.split('.').pop());
        updateFileInfo(file);
    });

    return thumbnail;
}

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const fileURL = URL.createObjectURL(file);
        const fileType = file.type || file.name.split('.').pop();
        document.getElementById('coordinatesInput').style.display = 'none';
        document.getElementById('gpxUpload').style.display = 'none';

        if (fileType.includes('image')) {
            const location = await getImageLocation(file);
            if (location) {
                updatePlanPluginPosition(location.lat, location.lon);
                fileCoordinates.set(fileURL, location);
                document.getElementById('latInput').value = location.lat;
                document.getElementById('lonInput').value = location.lon;
            } else {
                document.getElementById('coordinatesInput').style.display = 'block';
            }
        } else if (fileType.includes('video') || fileType === 'insv') {
            document.getElementById('gpxUpload').style.display = 'block';
        }

        if (this.id === 'fileInput') {
            uploadScreen.style.display = 'none';
            loadingScreen.style.display = 'flex';

            setTimeout(() => {
                loadingScreen.style.display = 'none';
                viewerContainer.style.display = 'flex';
                const thumbnail = createThumbnail(file, fileURL);
                thumbnail.classList.add('active');
                thumbnailContainer.appendChild(thumbnail);
                initViewer(fileURL, fileType);
                updateFileInfo(file);
            }, 1500);
        } else {
            const thumbnail = createThumbnail(file, fileURL);
            thumbnailContainer.appendChild(thumbnail);
        }
    }
}

function updateFileInfo(file) {
    const fileInfoSection = document.getElementById('fileInfo');
    if (fileInfoSection) {
        fileInfoSection.innerHTML = `
            <p><strong>Nombre:</strong> ${file.name}</p>
            <p><strong>Tipo:</strong> ${file.type || 'Desconocido'}</p>
            <p><strong>Tamaño:</strong> ${(file.size / (1024 * 1024)).toFixed(2)} MB</p>
            <p><strong>Última modificación:</strong> ${new Date(file.lastModified).toLocaleDateString()}</p>
        `;
    }
}

// Referencias a elementos del DOM
const uploadScreen = document.getElementById('uploadScreen');
const loadingScreen = document.getElementById('loadingScreen');
const viewerContainer = document.getElementById('viewerContainer');
const thumbnailContainer = document.getElementById('thumbnailContainer');

// Event listeners
document.getElementById('fileInput').addEventListener('change', handleFileUpload);
document.getElementById('additionalFileInput').addEventListener('change', handleFileUpload);
document.getElementById('addImageBtn').addEventListener('click', () => {
    document.getElementById('additionalFileInput').click();
});

// Evento para advertencia al cerrar la pestaña
window.addEventListener('beforeunload', (event) => {
    if (thumbnailContainer && thumbnailContainer.children.length > 0) {
        event.preventDefault();
        event.returnValue = 'Los elementos cargados se perderán. ¿Estás seguro de que quieres cerrar la ventana?';
    }
});