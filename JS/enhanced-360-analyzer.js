// enhanced-360-analyzer.js - Analizador mejorado completo con imágenes clickeables

class Enhanced360Analyzer {
    constructor() {
        this.facadeAnalyzer = window.facadeAnalyzer;
        
        // Definir las regiones de extracción para cada perspectiva
        // Estas coordenadas están cuidadosamente calculadas para capturar
        // las diferentes vistas de la calle en un video equirectangular
        this.perspectives = {
            frontal: {
                name: "Vista Frontal",
                // Centro del fotograma - donde apunta la cámara inicialmente
                cropRegion: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
                icon: "🏠",
                description: "Fachadas del lado principal de la calle"
            },
            izquierda: {
                name: "Vista Izquierda", 
                // Región izquierda del fotograma equirectangular
                cropRegion: { x: 0.0, y: 0.25, width: 0.3, height: 0.5 },
                icon: "⬅️",
                description: "Fachadas del lado izquierdo de la calle"
            },
            derecha: {
                name: "Vista Derecha",
                // Región derecha del fotograma equirectangular
                cropRegion: { x: 0.7, y: 0.25, width: 0.3, height: 0.5 },
                icon: "➡️", 
                description: "Fachadas del lado derecho de la calle"
            },
            trasera: {
                name: "Vista Trasera",
                // La vista trasera requiere combinar los bordes extremos
                cropRegion: { x: 0.0, y: 0.25, width: 0.15, height: 0.5 },
                cropRegion2: { x: 0.85, y: 0.25, width: 0.15, height: 0.5 },
                icon: "🔄",
                description: "Fachadas del lado opuesto (vista trasera)"
            }
        };
        
        // Canvas temporal para procesamiento de regiones
        this.processingCanvas = null;
        this.processingContext = null;
        this.setupProcessingCanvas();
    }
    
    // Configurar canvas temporal para procesamiento
    // Este canvas se usa para extraer y redimensionar las regiones específicas
    setupProcessingCanvas() {
        this.processingCanvas = document.createElement('canvas');
        this.processingContext = this.processingCanvas.getContext('2d');
        // Mantener el canvas fuera de la vista pero en el DOM
        this.processingCanvas.style.position = 'absolute';
        this.processingCanvas.style.left = '-9999px';
        this.processingCanvas.style.top = '-9999px';
        document.body.appendChild(this.processingCanvas);
    }
    
    // Extraer una región específica del fotograma equirectangular
    // Este método toma una porción del video 360° y la convierte en una imagen normal
    extractRegion(sourceCanvas, cropRegion, outputSize = { width: 224, height: 224 }) {
        const sourceWidth = sourceCanvas.width;
        const sourceHeight = sourceCanvas.height;
        
        // Calcular coordenadas absolutas basadas en porcentajes
        const cropX = Math.floor(cropRegion.x * sourceWidth);
        const cropY = Math.floor(cropRegion.y * sourceHeight);
        const cropWidth = Math.floor(cropRegion.width * sourceWidth);
        const cropHeight = Math.floor(cropRegion.height * sourceHeight);
        
        // Configurar el canvas de salida
        this.processingCanvas.width = outputSize.width;
        this.processingCanvas.height = outputSize.height;
        
        // Extraer y redimensionar la región específica
        this.processingContext.drawImage(
            sourceCanvas,
            cropX, cropY, cropWidth, cropHeight,  // Región fuente
            0, 0, outputSize.width, outputSize.height  // Destino redimensionado
        );
        
        return this.processingCanvas;
    }
    
    // Extraer vista trasera combinando los bordes del video 360°
    // En videos equirectangulares, la vista trasera está dividida en los bordes
    extractRearView(sourceCanvas, outputSize = { width: 224, height: 224 }) {
        const sourceWidth = sourceCanvas.width;
        const sourceHeight = sourceCanvas.height;
        
        this.processingCanvas.width = outputSize.width;
        this.processingCanvas.height = outputSize.height;
        
        const rearConfig = this.perspectives.trasera;
        
        // Extraer borde izquierdo del video
        const leftCrop = rearConfig.cropRegion;
        const leftX = Math.floor(leftCrop.x * sourceWidth);
        const leftY = Math.floor(leftCrop.y * sourceHeight);
        const leftWidth = Math.floor(leftCrop.width * sourceWidth);
        const leftHeight = Math.floor(leftCrop.height * sourceHeight);
        
        // Extraer borde derecho del video
        const rightCrop = rearConfig.cropRegion2;
        const rightX = Math.floor(rightCrop.x * sourceWidth);
        const rightY = Math.floor(rightCrop.y * sourceHeight);
        const rightWidth = Math.floor(rightCrop.width * sourceWidth);
        const rightHeight = Math.floor(rightCrop.height * sourceHeight);
        
        // Combinar ambos bordes en una sola imagen coherente
        // El borde derecho del video va a la mitad izquierda del resultado
        this.processingContext.drawImage(
            sourceCanvas,
            rightX, rightY, rightWidth, rightHeight,
            0, 0, outputSize.width / 2, outputSize.height
        );
        
        // El borde izquierdo del video va a la mitad derecha del resultado
        this.processingContext.drawImage(
            sourceCanvas,
            leftX, leftY, leftWidth, leftHeight,
            outputSize.width / 2, 0, outputSize.width / 2, outputSize.height
        );
        
        return this.processingCanvas;
    }
    
    // Analizar un fotograma completo extrayendo todas las perspectivas
    // Este es el método principal que coordina todo el análisis 360°
    async analyzeVideoFrame360(videoElement, currentTime) {
        try {
            console.log(`Analizando fotograma 360° en tiempo: ${currentTime}s`);
            
            // Capturar el fotograma actual del video
            const frameCanvas = document.getElementById('frameCanvas');
            if (!frameCanvas) {
                throw new Error('Canvas de fotogramas no encontrado');
            }
            
            const ctx = frameCanvas.getContext('2d');
            frameCanvas.width = videoElement.videoWidth || 1920;
            frameCanvas.height = videoElement.videoHeight || 960;
            
            // Dibujar el fotograma actual del video en el canvas
            ctx.drawImage(videoElement, 0, 0);
            
            // Obtener coordenadas GPS si están disponibles
            const coordinates = window.getCurrentCoordinatesForTime ? 
                window.getCurrentCoordinatesForTime(currentTime) : null;
            
            // Estructura de resultado que contendrá todas las perspectivas
            const frameResult = {
                timestamp: currentTime,
                coordinates: coordinates,
                thumbnail: frameCanvas.toDataURL('image/jpeg', 0.7), // Miniatura del fotograma completo
                perspectives: []
            };
            
            // Procesar cada perspectiva individualmente
            for (const [perspectiveKey, perspectiveConfig] of Object.entries(this.perspectives)) {
                console.log(`Procesando perspectiva: ${perspectiveConfig.name}`);
                
                let regionCanvas;
                
                // La vista trasera requiere procesamiento especial
                if (perspectiveKey === 'trasera') {
                    regionCanvas = this.extractRearView(frameCanvas);
                } else {
                    regionCanvas = this.extractRegion(frameCanvas, perspectiveConfig.cropRegion);
                }
                
                // Analizar esta región específica con el modelo de fachadas
                const perspectiveResults = await this.facadeAnalyzer.analyzeImage(
                    regionCanvas, 
                    currentTime, 
                    coordinates
                );
                
                // Agregar metadatos de la perspectiva
                const perspectiveAnalysis = {
                    perspective: perspectiveKey,
                    name: perspectiveConfig.name,
                    icon: perspectiveConfig.icon,
                    description: perspectiveConfig.description,
                    thumbnail: regionCanvas.toDataURL('image/jpeg', 0.8),
                    predictions: perspectiveResults.predictions
                };
                
                frameResult.perspectives.push(perspectiveAnalysis);
            }
            
            console.log(`Análisis 360° completado para tiempo ${currentTime}s: ${frameResult.perspectives.length} perspectivas`);
            return frameResult;
            
        } catch (error) {
            console.error('Error analizando fotograma 360°:', error);
            throw error;
        }
    }
    
    // Crear elemento de resultado mejorado con imágenes clickeables
    // Este método genera toda la interfaz visual para mostrar los resultados
    createEnhanced360Result(result, frameNumber) {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'frame-result enhanced-360-result';
        
        // Header principal del fotograma con información clave
        const headerHTML = `
            <div class="frame-header">
                <h4>🌐 Fotograma 360° #${frameNumber}</h4>
                <span class="frame-time">${this.formatTime(result.timestamp)}</span>
                ${result.coordinates ? 
                    `<span class="frame-coords">📍 ${result.coordinates.lat.toFixed(6)}, ${result.coordinates.lon.toFixed(6)}</span>` 
                    : ''}
            </div>
        `;
        
        // Contenido principal con imagen general y todas las perspectivas
        const contentHTML = `
            <div class="frame-content-360">
                <div class="overview-section">
                    <h5>Vista General del Fotograma</h5>
                    <img src="${result.thumbnail}" 
                         class="main-frame-thumbnail clickable-image" 
                         alt="Fotograma completo ${frameNumber}"
                         data-frame-number="${frameNumber}"
                         data-image-type="main">
                    <p class="frame-description">
                        Análisis de ${result.perspectives.length} perspectivas extraídas del video 360°
                        <br><span class="click-hint">💡 Haz clic en cualquier imagen para verla en tamaño completo</span>
                    </p>
                </div>
                
                <div class="perspectives-grid">
                    ${result.perspectives.map((perspective, index) => this.createPerspectiveHTML(perspective, frameNumber, index)).join('')}
                </div>
                
                <div class="consensus-analysis">
                    ${this.generateMultiPerspectiveConsensus(result.perspectives)}
                </div>
            </div>
        `;
        
        resultDiv.innerHTML = headerHTML + contentHTML;
        
        // Configurar eventos de clic para las imágenes después de crear el HTML
        this.setupImageClickEvents(resultDiv, result, frameNumber);
        
        // Agregar estilos CSS específicos para el diseño mejorado
        this.addEnhanced360Styles();
        
        return resultDiv;
    }
    
    // Crear HTML para una perspectiva individual con imagen clickeable
    // Cada perspectiva se muestra como una tarjeta independiente
    createPerspectiveHTML(perspective, frameNumber, perspectiveIndex) {
        return `
            <div class="perspective-analysis">
                <div class="perspective-header">
                    <span class="perspective-icon">${perspective.icon}</span>
                    <h6 class="perspective-name">${perspective.name}</h6>
                </div>
                
                <div class="perspective-content">
                    <img src="${perspective.thumbnail}" 
                         class="perspective-thumbnail clickable-image" 
                         alt="${perspective.name}"
                         data-frame-number="${frameNumber}"
                         data-perspective="${perspective.perspective}"
                         data-perspective-index="${perspectiveIndex}"
                         data-image-type="perspective">
                    <div class="perspective-predictions">
                        <table class="predictions-table">
                            <thead>
                                <tr>
                                    <th>Modelo</th>
                                    <th>Tipología</th>
                                    <th>Material</th>
                                    <th>Pisos</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${perspective.predictions.map(pred => `
                                    <tr>
                                        <td><strong>${pred.modelo.toUpperCase()}</strong></td>
                                        <td>${pred.tipologia}</td>
                                        <td>${pred.material_fachada}</td>
                                        <td style="text-align: center;">${pred.pisos}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <p class="perspective-description">${perspective.description}</p>
            </div>
        `;
    }
    
    // Configurar eventos de clic para todas las imágenes clickeables
    // Este método hace que las imágenes respondan al clic del usuario
    setupImageClickEvents(resultDiv, result, frameNumber) {
        const clickableImages = resultDiv.querySelectorAll('.clickable-image');
        
        clickableImages.forEach(img => {
            // Configurar estilos visuales para indicar que son clickeables
            img.style.cursor = 'pointer';
            img.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
            
            // Efectos visuales cuando el usuario pasa el mouse por encima
            img.addEventListener('mouseenter', () => {
                img.style.transform = 'scale(1.05)';
                img.style.boxShadow = '0 4px 15px rgba(52, 152, 219, 0.3)';
            });
            
            img.addEventListener('mouseleave', () => {
                img.style.transform = 'scale(1)';
                img.style.boxShadow = '';
            });
            
            // Evento principal de clic
            img.addEventListener('click', (e) => {
                e.stopPropagation(); // Evitar que el clic se propague a otros elementos
                this.handleImageClick(img, result, frameNumber);
            });
        });
    }
    
    // Manejar clic en imagen para abrir modal apropiado
    // Determina qué tipo de imagen se clickeó y actúa en consecuencia
    handleImageClick(imgElement, result, frameNumber) {
        const imageType = imgElement.dataset.imageType;
        
        if (imageType === 'main') {
            // Usuario clickeó la imagen principal del fotograma
            this.openMainImageModal(imgElement, result, frameNumber);
        } else if (imageType === 'perspective') {
            // Usuario clickeó una perspectiva específica
            this.openPerspectiveModal(imgElement, result, frameNumber);
        }
    }
    
    // Abrir modal con la imagen principal del fotograma
    // Muestra el fotograma completo y permite navegar a las perspectivas
    openMainImageModal(imgElement, result, frameNumber) {
        const imageData = window.imageModalViewer.constructor.createImageDataFromElement(imgElement, {
            title: `Fotograma Completo #${frameNumber}`,
            description: `Vista equirectangular completa del fotograma en tiempo ${this.formatTime(result.timestamp)}`,
            filename: `fotograma_${frameNumber}_completo.jpg`,
            metadata: {
                frameNumber: frameNumber,
                timestamp: result.timestamp,
                coordinates: result.coordinates,
                type: 'fotograma_completo'
            }
        });
        
        // Crear array con todas las imágenes del fotograma (principal + perspectivas)
        const allImages = [imageData];
        
        // Agregar todas las perspectivas al array de imágenes
        result.perspectives.forEach((perspective, index) => {
            const perspectiveData = window.imageModalViewer.constructor.createImageDataFromElement({
                src: perspective.thumbnail,
                alt: perspective.name
            }, {
                title: `${perspective.name} - Fotograma #${frameNumber}`,
                description: perspective.description,
                shortTitle: perspective.icon + ' ' + perspective.name.split(' ')[1],
                filename: `fotograma_${frameNumber}_${perspective.perspective}.jpg`,
                metadata: {
                    frameNumber: frameNumber,
                    timestamp: result.timestamp,
                    coordinates: result.coordinates,
                    perspective: perspective.perspective,
                    predictions: perspective.predictions
                }
            });
            allImages.push(perspectiveData);
        });
        
        // Abrir modal empezando por la imagen principal (índice 0)
        window.imageModalViewer.openModal(imageData, allImages, 0);
    }
    
    // Abrir modal con las perspectivas, empezando por la seleccionada
    // Permite al usuario navegar entre las diferentes vistas extraídas
    openPerspectiveModal(imgElement, result, frameNumber) {
        const perspectiveIndex = parseInt(imgElement.dataset.perspectiveIndex);
        
        // Crear array solo con las perspectivas (sin la imagen principal)
        const perspectiveImages = result.perspectives.map((perspective, index) => {
            return window.imageModalViewer.constructor.createImageDataFromElement({
                src: perspective.thumbnail,
                alt: perspective.name
            }, {
                title: `${perspective.name} - Fotograma #${frameNumber}`,
                description: `${perspective.description}\n\nResultados del análisis:\n${this.formatPredictionsForModal(perspective.predictions)}`,
                shortTitle: perspective.icon + ' ' + perspective.name.split(' ')[1],
                filename: `fotograma_${frameNumber}_${perspective.perspective}.jpg`,
                metadata: {
                    frameNumber: frameNumber,
                    timestamp: result.timestamp,
                    coordinates: result.coordinates,
                    perspective: perspective.perspective,
                    predictions: perspective.predictions
                }
            });
        });
        
        // Abrir modal empezando por la perspectiva que el usuario clickeó
        window.imageModalViewer.openModal(
            perspectiveImages[perspectiveIndex], 
            perspectiveImages, 
            perspectiveIndex
        );
    }
    
    // Formatear predicciones para mostrar en el modal de información
    // Convierte los resultados del análisis en texto legible
    formatPredictionsForModal(predictions) {
        return predictions.map(pred => 
            `${pred.modelo.toUpperCase()}: ${pred.tipologia} | ${pred.material_fachada} | ${pred.pisos} pisos`
        ).join('\n');
    }
    
    // Generar análisis de consenso entre múltiples perspectivas
    // Identifica patrones comunes en las predicciones de diferentes vistas
    generateMultiPerspectiveConsensus(perspectives) {
        const consensusData = {
            tipologia: {},
            material_fachada: {},
            pisos: {}
        };
        
        // Contar ocurrencias de cada predicción en todas las perspectivas
        perspectives.forEach(perspective => {
            perspective.predictions.forEach(prediction => {
                Object.keys(consensusData).forEach(task => {
                    const value = prediction[task];
                    if (value && value !== '❌ No encontrado') {
                        consensusData[task][value] = (consensusData[task][value] || 0) + 1;
                    }
                });
            });
        });
        
        // Clasificar consensos por fuerza
        const strongConsensus = [];
        const partialConsensus = [];
        
        Object.keys(consensusData).forEach(task => {
            const values = consensusData[task];
            Object.keys(values).forEach(value => {
                const count = values[value];
                
                // Consenso fuerte: aparece en al menos 4 predicciones
                if (count >= 4) {
                    strongConsensus.push(`<strong>${task.replace('_', ' ')}:</strong> ${value} (${count} coincidencias)`);
                } 
                // Consenso parcial: aparece en al menos 2 predicciones
                else if (count >= 2) {
                    partialConsensus.push(`${task.replace('_', ' ')}: ${value} (${count} coincidencias)`);
                }
            });
        });
        
        // Generar HTML del análisis de consenso
        let consensusHTML = '';
        
        if (strongConsensus.length > 0) {
            consensusHTML += `
                <div class="strong-consensus">
                    <h6>🎯 Consenso Fuerte entre Perspectivas:</h6>
                    <p>${strongConsensus.join(' | ')}</p>
                </div>
            `;
        }
        
        if (partialConsensus.length > 0) {
            consensusHTML += `
                <div class="partial-consensus">
                    <h6>📊 Consenso Parcial:</h6>
                    <p>${partialConsensus.join(' | ')}</p>
                </div>
            `;
        }
        
        if (strongConsensus.length === 0 && partialConsensus.length === 0) {
            consensusHTML = `
                <div class="no-consensus">
                    <h6>🔍 Análisis Diverso:</h6>
                    <p>Las diferentes perspectivas muestran variedad en los tipos de fachadas, indicando diversidad arquitectónica en ambos lados de la calle.</p>
                </div>
            `;
        }
        
        return consensusHTML;
    }
    
    // Agregar estilos CSS para el diseño mejorado con imágenes clickeables
    // Define toda la apariencia visual de los elementos clickeables
    addEnhanced360Styles() {
        if (document.getElementById('enhanced-360-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'enhanced-360-styles';
        styles.textContent = `
            .enhanced-360-result {
                border: 2px solid #3498db;
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            }
            
            .frame-content-360 {
                padding: 20px;
            }
            
            .overview-section {
                text-align: center;
                margin-bottom: 25px;
                padding: 15px;
                background: white;
                border-radius: 10px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            
            .main-frame-thumbnail {
                width: 300px;
                height: 150px;
                object-fit: cover;
                border-radius: 8px;
                margin: 10px 0;
                border: 2px solid #dee2e6;
                position: relative;
            }
            
            /* Tooltip que aparece al hacer hover en la imagen principal */
            .main-frame-thumbnail.clickable-image::after {
                content: '🔍 Click para ampliar';
                position: absolute;
                bottom: 5px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.8em;
                opacity: 0;
                transition: opacity 0.2s ease;
                pointer-events: none;
            }
            
            .main-frame-thumbnail.clickable-image:hover::after {
                opacity: 1;
            }
            
            .click-hint {
                color: #6c757d;
                font-size: 0.85em;
                font-style: italic;
            }
            
            .frame-description {
                color: #6c757d;
                font-style: italic;
                margin: 10px 0 0 0;
            }
            
            .perspectives-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                gap: 20px;
                margin-bottom: 25px;
            }
            
            .perspective-analysis {
                background: white;
                border-radius: 10px;
                padding: 15px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                border-left: 4px solid #3498db;
            }
            
            .perspective-header {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid #dee2e6;
            }
            
            .perspective-icon {
                font-size: 1.5em;
            }
            
            .perspective-name {
                margin: 0;
                color: #2c3e50;
                font-size: 1.1em;
            }
            
            .perspective-content {
                display: flex;
                gap: 15px;
                align-items: flex-start;
                margin-bottom: 10px;
            }
            
            .perspective-thumbnail {
                width: 120px;
                height: 120px;
                object-fit: cover;
                border-radius: 8px;
                border: 1px solid #dee2e6;
                flex-shrink: 0;
                position: relative;
            }
            
            /* Icono de zoom que aparece en las perspectivas */
            .perspective-thumbnail.clickable-image::after {
                content: '🔍';
                position: absolute;
                top: 5px;
                right: 5px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.8em;
                opacity: 0;
                transition: opacity 0.2s ease;
                pointer-events: none;
            }
            
            .perspective-thumbnail.clickable-image:hover::after {
                opacity: 1;
            }
            
            .perspective-predictions {
                flex: 1;
                overflow-x: auto;
            }
            
            .perspective-description {
                font-size: 0.9em;
                color: #6c757d;
                margin: 0;
                font-style: italic;
            }
            
            .consensus-analysis {
                background: #f8f9fa;
                border-radius: 10px;
                padding: 20px;
                border-left: 4px solid #28a745;
            }
            
            .strong-consensus {
                background: #d4edda;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 15px;
                border-left: 4px solid #28a745;
            }
            
            .partial-consensus {
                background: #fff3cd;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 15px;
                border-left: 4px solid #ffc107;
            }
            
            .no-consensus {
                background: #f8d7da;
                padding: 15px;
                border-radius: 8px;
                border-left: 4px solid #dc3545;
            }
            
            .consensus-analysis h6 {
                margin: 0 0 10px 0;
                color: #2c3e50;
            }
            
            .consensus-analysis p {
                margin: 0;
                line-height: 1.5;
            }
            
            /* Efectos hover universales para todas las imágenes clickeables */
            .clickable-image {
                transition: transform 0.2s ease, box-shadow 0.2s ease !important;
                cursor: pointer !important;
            }
            
            .clickable-image:hover {
                transform: scale(1.05) !important;
                box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3) !important;
            }
            
            /* Diseño responsivo para dispositivos móviles */
            @media (max-width: 768px) {
                .perspectives-grid {
                    grid-template-columns: 1fr;
                }
                
                .perspective-content {
                    flex-direction: column;
                }
                
                .perspective-thumbnail {
                    width: 100%;
                    height: 200px;
                }
                
                .main-frame-thumbnail {
                    width: 100%;
                    height: auto;
                }
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    // Método auxiliar para formatear tiempo en formato legible
    formatTime(seconds) {
        if (typeof seconds === 'number') {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        return seconds;
    }
    
    // Exportar resultados 360° a CSV con múltiples perspectivas
    // Genera un archivo CSV detallado con todos los datos del análisis
    exportResults360ToCSV(results) {
        let csv = 'Fotograma,Tiempo,Latitud,Longitud,Perspectiva,Modelo,Tipologia,Material_Fachada,Pisos\n';
        
        results.forEach((result, frameIdx) => {
            result.perspectives.forEach(perspective => {
                perspective.predictions.forEach(pred => {
                    csv += `${frameIdx + 1},${result.timestamp},`;
                    csv += result.coordinates ? `${result.coordinates.lat},${result.coordinates.lon},` : ',,';
                    csv += `${perspective.name},${pred.modelo},${pred.tipologia},${pred.material_fachada},${pred.pisos}\n`;
                });
            });
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analisis_360_fachadas_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Método de diagnóstico para verificar el estado del analizador
    // Útil para debugging y verificación del sistema
    getStatus() {
        return {
            perspectivesConfigured: Object.keys(this.perspectives).length,
            processingCanvasReady: !!this.processingCanvas,
            facadeAnalyzerReady: !!this.facadeAnalyzer,
            perspectives: Object.keys(this.perspectives)
        };
    }

    // Método para obtener información detallada de las regiones configuradas
    // Útil para ajustar las coordenadas de extracción si es necesario
    getPerspectiveRegions() {
        const regions = {};
        Object.entries(this.perspectives).forEach(([key, config]) => {
            regions[key] = {
                name: config.name,
                description: config.description,
                mainRegion: config.cropRegion,
                secondaryRegion: config.cropRegion2 || null
            };
        });
        return regions;
    }

    // Método para actualizar dinámicamente las regiones de perspectiva
    // Permite ajustar las coordenadas de extracción sin reiniciar la aplicación
    updatePerspectiveRegion(perspectiveKey, newCropRegion, newSecondaryRegion = null) {
        if (this.perspectives[perspectiveKey]) {
            this.perspectives[perspectiveKey].cropRegion = newCropRegion;
            if (newSecondaryRegion) {
                this.perspectives[perspectiveKey].cropRegion2 = newSecondaryRegion;
            }
            console.log(`Región actualizada para ${perspectiveKey}:`, newCropRegion);
            return true;
        }
        console.error(`Perspectiva ${perspectiveKey} no encontrada`);
        return false;
    }

    // Método para validar que una imagen es compatible con el análisis 360°
    // Verifica las dimensiones y relación de aspecto
    validateVideo360Compatibility(videoElement) {
        const width = videoElement.videoWidth || 0;
        const height = videoElement.videoHeight || 0;
        const aspectRatio = width / height;
        
        const validation = {
            isValid: false,
            aspectRatio: aspectRatio,
            width: width,
            height: height,
            recommendations: []
        };
        
        // Videos 360° equirectangulares típicamente tienen relación 2:1
        if (aspectRatio >= 1.8 && aspectRatio <= 2.2) {
            validation.isValid = true;
            validation.recommendations.push('✅ Relación de aspecto compatible con video 360°');
        } else {
            validation.recommendations.push('⚠️ La relación de aspecto no es típica de videos 360°');
            validation.recommendations.push(`📐 Relación actual: ${aspectRatio.toFixed(2)}, esperada: ~2.0`);
        }
        
        // Verificar resolución mínima
        if (width >= 1920 && height >= 960) {
            validation.recommendations.push('✅ Resolución adecuada para análisis detallado');
        } else if (width >= 1280 && height >= 640) {
            validation.recommendations.push('⚠️ Resolución aceptable, pero se recomienda mayor calidad');
        } else {
            validation.recommendations.push('❌ Resolución baja, puede afectar la calidad del análisis');
        }
        
        return validation;
    }

    // Método para generar un reporte completo de un frame analizado
    // Útil para documentación y análisis posterior
    generateFrameReport(result, frameNumber) {
        const report = {
            frameInfo: {
                number: frameNumber,
                timestamp: result.timestamp,
                formattedTime: this.formatTime(result.timestamp),
                coordinates: result.coordinates
            },
            perspectivesSummary: {
                total: result.perspectives.length,
                analyzed: result.perspectives.filter(p => p.predictions.length > 0).length
            },
            detailedAnalysis: {},
            consensus: this.analyzePerspectiveConsensus(result.perspectives),
            recommendations: []
        };
        
        // Análisis detallado por perspectiva
        result.perspectives.forEach(perspective => {
            report.detailedAnalysis[perspective.perspective] = {
                name: perspective.name,
                description: perspective.description,
                predictions: perspective.predictions,
                dominant: this.findDominantPrediction(perspective.predictions)
            };
        });
        
        // Generar recomendaciones basadas en el análisis
        this.generateRecommendations(report);
        
        return report;
    }

    // Analizar consenso entre perspectivas de manera programática
    // Retorna datos estructurados sobre el consenso
    analyzePerspectiveConsensus(perspectives) {
        const consensus = {
            strong: {},
            partial: {},
            conflicts: []
        };
        
        const votes = { tipologia: {}, material_fachada: {}, pisos: {} };
        
        // Contar votos por cada predicción
        perspectives.forEach(perspective => {
            perspective.predictions.forEach(prediction => {
                Object.keys(votes).forEach(task => {
                    const value = prediction[task];
                    if (value && value !== '❌ No encontrado') {
                        votes[task][value] = (votes[task][value] || 0) + 1;
                    }
                });
            });
        });
        
        // Clasificar consensos
        Object.keys(votes).forEach(task => {
            const taskVotes = votes[task];
            const sortedVotes = Object.entries(taskVotes).sort((a, b) => b[1] - a[1]);
            
            if (sortedVotes.length > 0) {
                const [topValue, topCount] = sortedVotes[0];
                
                if (topCount >= 4) {
                    consensus.strong[task] = { value: topValue, count: topCount };
                } else if (topCount >= 2) {
                    consensus.partial[task] = { value: topValue, count: topCount };
                }
                
                // Detectar conflictos (múltiples valores con votos similares)
                if (sortedVotes.length > 1) {
                    const [, secondCount] = sortedVotes[1];
                    if (Math.abs(topCount - secondCount) <= 1) {
                        consensus.conflicts.push({
                            task: task,
                            options: sortedVotes.slice(0, 2)
                        });
                    }
                }
            }
        });
        
        return consensus;
    }

    // Encontrar la predicción dominante para una perspectiva
    // Identifica la predicción más confiable basada en consenso entre modelos
    findDominantPrediction(predictions) {
        if (predictions.length < 2) return null;
        
        const tasks = ['tipologia', 'material_fachada', 'pisos'];
        const dominant = {};
        
        tasks.forEach(task => {
            const values = predictions.map(p => p[task]).filter(v => v && v !== '❌ No encontrado');
            if (values.length >= 2 && values[0] === values[1]) {
                dominant[task] = values[0];
            }
        });
        
        return Object.keys(dominant).length > 0 ? dominant : null;
    }

    // Generar recomendaciones basadas en el análisis
    // Proporciona insights automáticos sobre los resultados
    generateRecommendations(report) {
        const { consensus, perspectivesSummary } = report;
        
        // Recomendaciones basadas en consenso
        if (Object.keys(consensus.strong).length >= 2) {
            report.recommendations.push('🎯 Consenso fuerte detectado - Alta confiabilidad en las predicciones');
        } else if (consensus.conflicts.length > 0) {
            report.recommendations.push('⚠️ Conflictos detectados - Revisar manualmente las predicciones discrepantes');
        }
        
        // Recomendaciones basadas en cobertura
        if (perspectivesSummary.analyzed < perspectivesSummary.total) {
            report.recommendations.push('📊 Algunas perspectivas no generaron predicciones - Verificar calidad de imagen');
        }
        
        // Recomendaciones específicas por tipo de análisis
        Object.entries(report.detailedAnalysis).forEach(([key, analysis]) => {
            if (analysis.dominant) {
                const dominantCount = Object.keys(analysis.dominant).length;
                if (dominantCount >= 2) {
                    report.recommendations.push(`✅ ${analysis.name}: Predicciones consistentes entre modelos`);
                }
            }
        });
    }
}

// Crear instancia global del analizador 360° mejorado
window.enhanced360Analyzer = new Enhanced360Analyzer();

// Agregar método de diagnóstico global para debugging
window.diagnose360System = function() {
    console.log('=== DIAGNÓSTICO DEL SISTEMA 360° ===');
    
    if (window.enhanced360Analyzer) {
        console.log('✅ Enhanced360Analyzer disponible');
        console.log('Estado:', window.enhanced360Analyzer.getStatus());
        console.log('Regiones configuradas:', window.enhanced360Analyzer.getPerspectiveRegions());
    } else {
        console.log('❌ Enhanced360Analyzer no disponible');
    }
    
    if (window.imageModalViewer) {
        console.log('✅ ImageModalViewer disponible');
    } else {
        console.log('❌ ImageModalViewer no disponible');
    }
    
    if (window.facadeAnalyzer) {
        console.log('✅ FacadeAnalyzer disponible');
        console.log('Modelos cargados:', window.facadeAnalyzer.modelsLoaded);
    } else {
        console.log('❌ FacadeAnalyzer no disponible');
    }
    
    console.log('===================================');
};

console.log('Enhanced360Analyzer cargado completamente con funcionalidad de imágenes clickeables');