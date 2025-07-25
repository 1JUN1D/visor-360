// script.js - Script principal completamente corregido con integración de red neuronal

let viewer;
let isVideo = false;
let gpxData = null;
let videoStartTime = null;
const fileCoordinates = new Map();
const fileGpxData = new Map();

// Función para inicializar el procesador de video de forma segura
function initializeVideoProcessor() {
    if (typeof VideoProcessor === 'undefined') {
        console.error('VideoProcessor class no está disponible');
        return null;
    }
    
    try {
        const processor = new VideoProcessor();
        console.log('VideoProcessor creado exitosamente');
        return processor;
    } catch (error) {
        console.error('Error creando VideoProcessor:', error);
        return null;
    }
}

// Inicialización del sistema con manejo robusto de errores
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Iniciando aplicación...');
    
    // Esperar un momento para asegurar que todos los scripts estén cargados
    setTimeout(async () => {
        // Inicializar el procesador de video globalmente
        window.videoProcessor = initializeVideoProcessor();
        
        if (!window.videoProcessor) {
            console.warn('No se pudo crear VideoProcessor, creando objeto básico');
            window.videoProcessor = {
                initialize: () => console.warn('VideoProcessor no disponible'),
                clearResults: () => console.warn('VideoProcessor no disponible'),
                reset: () => console.warn('VideoProcessor no disponible')
            };
        }
        
        // Inicializar el analizador de fachadas
        const modelStatus = document.getElementById('modelStatus');
        if (modelStatus) {
            modelStatus.style.display = 'block';
        }

        try {
            // Intentar inicializar el analizador
            console.log('Inicializando analizador de fachadas...');
            const initialized = await window.facadeAnalyzer.initialize();
            
            if (initialized) {
                console.log('Sistema de análisis inicializado correctamente');
                
                // Ocultar el estado de carga después de un breve retraso
                setTimeout(() => {
                    if (modelStatus) {
                        modelStatus.style.display = 'none';
                    }
                }, 2000);
            } else {
                throw new Error('La inicialización retornó false');
            }
        } catch (error) {
            console.error('Error inicializando el sistema:', error);
            
            // Mostrar mensaje de error pero permitir que la aplicación continúe
            if (modelStatus) {
                modelStatus.innerHTML = `
                    <p style="color: #e74c3c;">
                        ⚠️ Error cargando modelos: ${error.message}
                    </p>
                    <p style="color: #f39c12; font-size: 0.9em;">
                        La aplicación funcionará con datos simulados.
                    </p>
                `;
                
                // Ocultar después de 5 segundos
                setTimeout(() => {
                    if (modelStatus) {
                        modelStatus.style.display = 'none';
                    }
                }, 5000);
            }
            
            // Asegurar que el analizador tenga al menos la funcionalidad básica
            if (!window.facadeAnalyzer.modelsLoaded) {
                window.facadeAnalyzer.setDefaultData();
                window.facadeAnalyzer.generateLabelMaps();
                window.facadeAnalyzer.modelsLoaded = true;
            }
        }
        
        console.log('Aplicación lista para usar');
    }, 100); // 100ms de retraso para asegurar carga de scripts
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

    try {
        const text = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");

        // Verificar que el archivo GPX es válido
        const trkpts = xmlDoc.getElementsByTagName('trkpt');
        if (trkpts.length === 0) {
            alert('El archivo GPX no contiene puntos de seguimiento válidos.');
            return;
        }

        gpxData = Array.from(trkpts).map(point => ({
            lat: parseFloat(point.getAttribute('lat')),
            lon: parseFloat(point.getAttribute('lon')),
            time: new Date(point.getElementsByTagName('time')[0]?.textContent || Date.now()).getTime()
        }));

        gpxData.sort((a, b) => a.time - b.time);
        videoStartTime = gpxData[0].time;

        const currentFile = document.querySelector('.thumbnail.active')?.dataset.fileUrl;
        if (currentFile) {
            fileGpxData.set(currentFile, gpxData);
            updatePlanPluginPosition(gpxData[0].lat, gpxData[0].lon);
            syncPlanPluginWithVideo();
        }

        console.log(`GPX cargado exitosamente: ${gpxData.length} puntos`);
    } catch (error) {
        console.error('Error procesando archivo GPX:', error);
        alert('Error al procesar el archivo GPX. Verifique que sea un archivo válido.');
    }
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
        const currentFile = document.querySelector('.thumbnail.active')?.dataset.fileUrl;
        if (currentFile) {
            fileCoordinates.set(currentFile, { lat, lon });
        }
    }
}

function updatePlanPluginPosition(lat, lon) {
    try {
        const planPlugin = viewer?.getPlugin(PhotoSphereViewer.PlanPlugin);
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
            console.warn('PlanPlugin no está disponible.');
        }
    } catch (error) {
        console.error('Error actualizando posición del mapa:', error);
    }
}

function syncPlanPluginWithVideo() {
    try {
        const videoAdapter = viewer?.adapter;
        if (videoAdapter && videoAdapter.video && gpxData) {
            const videoElement = videoAdapter.video;
            
            // Remover listener anterior si existe
            videoElement.removeEventListener('timeupdate', handleVideoTimeUpdate);
            // Agregar nuevo listener
            videoElement.addEventListener('timeupdate', handleVideoTimeUpdate);
        } else {
            console.warn("No se pudo sincronizar el video con GPX.");
        }
    } catch (error) {
        console.error('Error sincronizando video con GPX:', error);
    }
}

// Función separada para manejar actualizaciones de tiempo
function handleVideoTimeUpdate(event) {
    const videoElement = event.target;
    const currentTimeMs = videoElement.currentTime * 1000;
    const closestPoint = findClosestGpxPoint(currentTimeMs);

    if (closestPoint) {
        updatePlanPluginPosition(closestPoint.lat, closestPoint.lon);
    }
}

function findClosestGpxPoint(currentTimeMs) {
    if (!gpxData || !videoStartTime) return null;
    
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
    // Limpiar viewer anterior si existe
    if (viewer) {
        try {
            viewer.destroy();
        } catch (error) {
            console.warn('Error destruyendo viewer anterior:', error);
        }
        viewer = null;
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
        
        // Configuración corregida para el plugin de video
        viewerConfig.plugins.push([PhotoSphereViewer.VideoPlugin, {
            // Removidas las opciones autoplay y progressBar que causan warnings
            // Estas se manejarán programáticamente después de la inicialización
        }]);

        if (fileGpxData.has(fileURL)) {
            gpxData = fileGpxData.get(fileURL);
            videoStartTime = gpxData[0].time;
            updatePlanPluginPosition(gpxData[0].lat, gpxData[0].lon);
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
    }

    // Crear el viewer con manejo de errores
    try {
        viewer = new PhotoSphereViewer.Viewer(viewerConfig);

        viewer.addEventListener('ready', () => {
            console.log('Viewer inicializado correctamente');
            triggerAutoUpdate();
            
            // Si es video, inicializar el procesador después de que todo esté listo
            if (isVideo && viewer.adapter && viewer.adapter.video) {
                setTimeout(() => {
                    if (window.videoProcessor) {
                        window.videoProcessor.initialize(viewer.adapter.video);
                        console.log('Video processor inicializado');
                    }
                }, 500); // Pequeño retraso para asegurar que todo esté listo
            } else if (!isVideo) {
                // Si es imagen estática, analizar automáticamente
                setTimeout(() => {
                    analyzeStaticImage(fileURL);
                }, 500);
            }
        });

        viewer.addEventListener('error', (error) => {
            console.error('Error en el viewer:', error);
        });

    } catch (error) {
        console.error('Error creando viewer:', error);
        alert('Error al cargar el archivo. Verifique que sea un formato válido.');
    }
}

// Analizar imagen estática con mejor manejo de errores
async function analyzeStaticImage(imageURL) {
    if (!window.facadeAnalyzer || !window.facadeAnalyzer.modelsLoaded) {
        console.log('Esperando a que los modelos se carguen...');
        // Intentar de nuevo en 2 segundos, máximo 10 intentos
        let attempts = 0;
        const waitForModels = () => {
            attempts++;
            if (attempts > 10) {
                console.warn('Timeout esperando modelos, usando datos por defecto');
                return;
            }
            if (window.facadeAnalyzer && window.facadeAnalyzer.modelsLoaded) {
                analyzeStaticImage(imageURL);
            } else {
                setTimeout(waitForModels, 2000);
            }
        };
        setTimeout(waitForModels, 2000);
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
            displayErrorResults('Error analizando la imagen');
        }
    };
    
    img.onerror = () => {
        console.error('Error cargando imagen para análisis');
        displayErrorResults('Error cargando la imagen');
    };
    
    img.src = imageURL;
}

// Mostrar resultados de imagen estática
function displayStaticImageResults(results) {
    const resultsContainer = document.getElementById('analysisResults');
    if (!resultsContainer) return;
    
    resultsContainer.innerHTML = '';
    
    try {
        const resultElement = window.facadeAnalyzer.createResultElement(results, 1);
        resultsContainer.appendChild(resultElement);
    } catch (error) {
        console.error('Error mostrando resultados:', error);
        displayErrorResults('Error mostrando los resultados del análisis');
    }
}

// Mostrar resultados de error
function displayErrorResults(message) {
    const resultsContainer = document.getElementById('analysisResults');
    if (!resultsContainer) return;
    
    resultsContainer.innerHTML = `
        <div class="frame-result">
            <div class="frame-header">
                <h4>Error de Análisis</h4>
            </div>
            <div class="frame-content">
                <p style="color: #e74c3c; text-align: center; padding: 20px;">
                    ${message}
                </p>
            </div>
        </div>
    `;
}

function triggerAutoUpdate() {
    const currentFile = document.querySelector('.thumbnail.active')?.dataset.fileUrl;
    if (!currentFile) return;

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
        
        // Si no quedan archivos, volver a la pantalla de upload
        if (thumbnailContainer.children.length === 0) {
            viewerContainer.style.display = 'none';
            uploadScreen.style.display = 'flex';
            
            // Destruir viewer si existe
            if (viewer) {
                try {
                    viewer.destroy();
                } catch (error) {
                    console.warn('Error destruyendo viewer:', error);
                }
                viewer = null;
            }
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
        video.onerror = () => {
            const img = document.createElement('img');
            img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYwIiBoZWlnaHQ9IjkwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxNjAiIGhlaWdodD0iOTAiIGZpbGw9IiNjY2MiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY2NiI+RXJyb3I8L3RleHQ+PC9zdmc+';
            thumbnail.appendChild(img);
        };
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
    if (!file) return;

    try {
        const fileURL = URL.createObjectURL(file);
        const fileType = file.type || file.name.split('.').pop();
        
        // Ocultar controles inicialmente
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
            // Primer archivo - mostrar pantalla de carga
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
            // Archivos adicionales
            const thumbnail = createThumbnail(file, fileURL);
            thumbnailContainer.appendChild(thumbnail);
        }
        
        // Limpiar el input
        e.target.value = '';
        
    } catch (error) {
        console.error('Error manejando archivo:', error);
        alert('Error al cargar el archivo. Verifique que sea un formato válido.');
    }
}

function updateFileInfo(file) {
    const fileInfoSection = document.getElementById('fileInfo');
    if (fileInfoSection) {
        const formatDate = (timestamp) => {
            return new Date(timestamp).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        };

        const formatSize = (bytes) => {
            if (bytes < 1024) return bytes + ' B';
            if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
            return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        };

        fileInfoSection.innerHTML = `
            <p><strong>Nombre:</strong> ${file.name}</p>
            <p><strong>Tipo:</strong> ${file.type || 'Desconocido'}</p>
            <p><strong>Tamaño:</strong> ${formatSize(file.size)}</p>
            <p><strong>Última modificación:</strong> ${formatDate(file.lastModified)}</p>
        `;
    }
}

// Referencias a elementos del DOM
const uploadScreen = document.getElementById('uploadScreen');
const loadingScreen = document.getElementById('loadingScreen');
const viewerContainer = document.getElementById('viewerContainer');
const thumbnailContainer = document.getElementById('thumbnailContainer');

// Event listeners con manejo de errores
try {
    document.getElementById('fileInput')?.addEventListener('change', handleFileUpload);
    document.getElementById('additionalFileInput')?.addEventListener('change', handleFileUpload);
    document.getElementById('addImageBtn')?.addEventListener('click', () => {
        document.getElementById('additionalFileInput')?.click();
    });
} catch (error) {
    console.error('Error configurando event listeners:', error);
}

// Evento para advertencia al cerrar la pestaña
window.addEventListener('beforeunload', (event) => {
    if (thumbnailContainer && thumbnailContainer.children.length > 0) {
        event.preventDefault();
        event.returnValue = 'Los elementos cargados se perderán. ¿Estás seguro de que quieres cerrar la ventana?';
    }
});

// Manejo de errores globales
window.addEventListener('error', (event) => {
    console.error('Error global capturado:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Promise rechazada no manejada:', event.reason);
    event.preventDefault(); // Prevenir que aparezca en la consola del navegador
});