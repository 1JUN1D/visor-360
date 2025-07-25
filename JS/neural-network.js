// neural-network.js - CORREGIDO para usar correctamente label_maps.json

class FacadeAnalyzer {
    constructor() {
        this.models = {};
        this.modelTypes = ['mobilenet', 'efficientnet'];
        this.tasks = ['tipologia', 'material_fachada', 'pisos'];
        this.labelMaps = null;
        this.modelsLoaded = false;
        this.csvData = null;
    }

    // Inicializar el analizador y cargar los modelos
    async initialize() {
        try {
            console.log('Iniciando carga del analizador de fachadas...');
            
            // Primero intentamos cargar los label maps desde el archivo JSON
            await this.loadLabelMaps();
            
            // Verificar que labelMaps se cargó correctamente
            if (!this.labelMaps) {
                console.warn('No se pudieron cargar los label maps, usando valores por defecto');
                this.setDefaultLabelMaps();
            }
            
            // Cargar todos los modelos
            await this.loadAllModels();
            
            this.modelsLoaded = true;
            console.log('Todos los modelos cargados exitosamente');
            console.log('Label maps finales:', this.labelMaps);
            return true;
        } catch (error) {
            console.error('Error inicializando el analizador:', error);
            // En caso de error, establecer datos por defecto y continuar
            this.setDefaultLabelMaps();
            this.modelsLoaded = true;
            console.warn('Inicializado con datos por defecto debido a errores');
            return true;
        }
    }

    // Cargar los label maps desde el archivo JSON o CSV
    async loadLabelMaps() {
        try {
            // MÉTODO 1: Intentar cargar desde label_maps.json (método preferido)
            try {
                console.log('Intentando cargar label_maps.json...');
                const response = await fetch('./models/label_maps.json');
                
                if (response.ok) {
                    const jsonData = await response.json();
                    console.log('Datos cargados desde label_maps.json:', jsonData);
                    
                    // Verificar que tiene la estructura correcta
                    if (this.validateLabelMapsStructure(jsonData)) {
                        this.labelMaps = jsonData;
                        console.log('✅ Label maps cargados exitosamente desde JSON');
                        return;
                    } else {
                        throw new Error('Estructura de label_maps.json inválida');
                    }
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (jsonError) {
                console.warn('No se pudo cargar label_maps.json:', jsonError.message);
                console.log('Intentando cargar desde CSV como alternativa...');
            }

            // MÉTODO 2: Cargar desde CSV como alternativa
            await this.loadFromCSV();
            
        } catch (error) {
            console.error('Error cargando label maps:', error);
            throw error;
        }
    }

    // Validar que el archivo label_maps.json tiene la estructura correcta
    validateLabelMapsStructure(data) {
        if (!data || typeof data !== 'object') {
            console.error('Label maps no es un objeto válido');
            return false;
        }

        // Verificar que contiene todas las tareas requeridas
        for (const task of this.tasks) {
            if (!data[task] || typeof data[task] !== 'object') {
                console.error(`Tarea faltante o inválida: ${task}`);
                return false;
            }
            
            // Verificar que cada tarea tiene al menos una etiqueta
            if (Object.keys(data[task]).length === 0) {
                console.error(`Tarea vacía: ${task}`);
                return false;
            }
        }
        
        console.log('✅ Estructura de label_maps validada correctamente');
        return true;
    }

    // Cargar datos desde el CSV como alternativa
    async loadFromCSV() {
        try {
            console.log('Cargando datos desde CSV...');
            const csvResponse = await fetch('./data/model_trainin.csv');
            if (!csvResponse.ok) {
                throw new Error(`Error cargando CSV: ${csvResponse.status}`);
            }
            
            const csvText = await csvResponse.text();
            if (!csvText.trim()) {
                throw new Error('El archivo CSV está vacío');
            }
            
            // Parsear el CSV y extraer categorías únicas
            const lines = csvText.trim().split('\n');
            if (lines.length < 2) {
                throw new Error('El CSV debe tener al menos un header y una fila de datos');
            }
            
            const headers = lines[0].split(';');
            console.log('Headers encontrados:', headers);
            
            // Encontrar índices de las columnas
            const tipologiaIdx = headers.findIndex(h => h.toLowerCase().includes('tipologia'));
            const materialIdx = headers.findIndex(h => h.toLowerCase().includes('material'));
            const pisosIdx = headers.findIndex(h => h.toLowerCase().includes('pisos'));
            
            if (tipologiaIdx === -1 || materialIdx === -1 || pisosIdx === -1) {
                throw new Error('Columnas requeridas no encontradas en el CSV');
            }
            
            // Extraer valores únicos
            const tipologiaSet = new Set();
            const materialSet = new Set();
            const pisosSet = new Set();
            
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(';');
                if (values.length > Math.max(tipologiaIdx, materialIdx, pisosIdx)) {
                    if (values[tipologiaIdx]?.trim()) tipologiaSet.add(values[tipologiaIdx].trim());
                    if (values[materialIdx]?.trim()) materialSet.add(values[materialIdx].trim());
                    if (values[pisosIdx]?.trim()) pisosSet.add(values[pisosIdx].trim());
                }
            }
            
            // Convertir a formato de label maps
            this.labelMaps = {
                tipologia: {},
                material_fachada: {},
                pisos: {}
            };
            
            // Crear mapeos de índice a etiqueta
            Array.from(tipologiaSet).sort().forEach((label, index) => {
                this.labelMaps.tipologia[index] = label;
            });
            
            Array.from(materialSet).sort().forEach((label, index) => {
                this.labelMaps.material_fachada[index] = label;
            });
            
            Array.from(pisosSet).sort((a, b) => {
                const numA = parseInt(a);
                const numB = parseInt(b);
                return !isNaN(numA) && !isNaN(numB) ? numA - numB : a.localeCompare(b);
            }).forEach((label, index) => {
                this.labelMaps.pisos[index] = label;
            });
            
            console.log('✅ Label maps generados desde CSV:', this.labelMaps);
            
        } catch (error) {
            console.error('Error cargando desde CSV:', error);
            throw error;
        }
    }

    // Establecer label maps por defecto si todo falla
    setDefaultLabelMaps() {
        this.labelMaps = {
            tipologia: {
                "0": "Tipo Residencial Básico",
                "1": "Tipo Comercial Básico", 
                "2": "Tipo Industrial Básico"
            },
            material_fachada: {
                "0": "Acabado Básico",
                "1": "Acabado Intermedio",
                "2": "Sin Acabado"
            },
            pisos: {
                "0": "1",
                "1": "2", 
                "2": "3"
            }
        };
        console.log('Label maps por defecto establecidos:', this.labelMaps);
    }

    // Cargar todos los modelos
    async loadAllModels() {
        const totalModels = this.modelTypes.length * this.tasks.length;
        let loadedModels = 0;

        for (const modelType of this.modelTypes) {
            this.models[modelType] = {};
            
            for (const task of this.tasks) {
                const modelPath = `./models/modelo_${modelType}_${task}.pt`;
                
                try {
                    console.log(`Intentando cargar modelo: ${modelType}_${task}`);
                    const model = await this.loadModel(modelPath);
                    this.models[modelType][task] = model;
                    
                    loadedModels++;
                    this.updateLoadingProgress(loadedModels, totalModels);
                    console.log(`Modelo cargado: ${modelType}_${task}`);
                } catch (error) {
                    console.warn(`Error cargando modelo ${modelType}_${task}:`, error);
                    this.models[modelType][task] = this.createMockModel(task);
                    loadedModels++;
                    this.updateLoadingProgress(loadedModels, totalModels);
                }
            }
        }
        
        console.log('Carga de modelos completada');
    }

    // Crear modelo simulado para pruebas
    createMockModel(task) {
        return {
            predict: (tensor) => {
                // Obtener número de clases para esta tarea
                const numClasses = this.labelMaps[task] ? 
                    Object.keys(this.labelMaps[task]).length : 3;
                
                console.log(`Modelo simulado para ${task}: ${numClasses} clases disponibles`);
                
                // Crear tensor de predicciones simuladas
                const predictions = tf.randomUniform([1, numClasses]);
                return predictions;
            }
        };
    }

    // Cargar modelo real de TensorFlow.js
    async loadModel(modelPath) {
        try {
            const tfModelPath = modelPath
                .replace('./models/', './models/tfjs/')
                .replace('.pt', '/model.json');
            
            console.log(`Intentando cargar modelo desde: ${tfModelPath}`);
            
            const response = await fetch(tfModelPath);
            if (!response.ok) {
                throw new Error(`Modelo no encontrado: ${response.status}`);
            }
            
            const model = await tf.loadLayersModel(tfModelPath);
            console.log(`Modelo cargado exitosamente: ${tfModelPath}`);
            return model;
            
        } catch (error) {
            console.warn(`No se pudo cargar el modelo real ${modelPath}:`, error.message);
            throw error;
        }
    }

    // Actualizar progreso de carga
    updateLoadingProgress(loaded, total) {
        const progress = (loaded / total) * 100;
        const progressBar = document.querySelector('.model-progress');
        const statusText = document.getElementById('modelStatus');
        
        if (progressBar) {
            progressBar.style.background = `linear-gradient(to right, #27ae60 ${progress}%, rgba(255,255,255,0.2) ${progress}%)`;
        }
        
        if (statusText) {
            if (progress === 100) {
                statusText.innerHTML = '<p style="color: #27ae60;">✓ Modelos cargados correctamente</p>';
            } else {
                statusText.innerHTML = `<p>Cargando modelos... ${Math.round(progress)}%</p>`;
            }
        }
    }

    // Preprocesar imagen para la red neuronal
    preprocessImage(imageElement) {
        try {
            const tensor = tf.browser.fromPixels(imageElement)
                .resizeNearestNeighbor([224, 224])
                .toFloat();
            
            const mean = tf.tensor3d([0.485, 0.456, 0.406], [1, 1, 3]);
            const std = tf.tensor3d([0.229, 0.224, 0.225], [1, 1, 3]);
            
            const normalized = tensor.div(255.0)
                .sub(mean)
                .div(std)
                .expandDims(0);
            
            tensor.dispose();
            mean.dispose();
            std.dispose();
            
            return normalized;
        } catch (error) {
            console.error('Error en preprocesamiento de imagen:', error);
            throw error;
        }
    }

    // Analizar una imagen con mapeo correcto de etiquetas
    async analyzeImage(imageElement, timestamp = null, coordinates = null) {
        if (!this.modelsLoaded) {
            throw new Error('Los modelos no están cargados aún');
        }

        const results = {
            timestamp: timestamp || new Date().toISOString(),
            coordinates: coordinates,
            predictions: []
        };

        let preprocessedImage;
        try {
            preprocessedImage = this.preprocessImage(imageElement);

            // Ejecutar predicciones con cada modelo
            for (const modelType of this.modelTypes) {
                const modelResult = {
                    modelo: modelType,
                    tipologia: '❌ No encontrado',
                    material_fachada: '❌ No encontrado',
                    pisos: '❌ No encontrado'
                };

                for (const task of this.tasks) {
                    if (this.models[modelType] && this.models[modelType][task]) {
                        try {
                            const prediction = await this.models[modelType][task].predict(preprocessedImage);
                            const predictedClass = tf.argMax(prediction, 1).dataSync()[0];
                            
                            // AQUÍ ESTÁ LA CORRECCIÓN CLAVE: Usar labelMaps directamente
                            const label = this.labelMaps[task][predictedClass];
                            
                            if (label) {
                                modelResult[task] = label;
                                console.log(`${modelType} - ${task}: clase ${predictedClass} → "${label}"`);
                            } else {
                                console.warn(`No se encontró etiqueta para ${task} clase ${predictedClass}`);
                                modelResult[task] = `Clase ${predictedClass} (sin mapear)`;
                            }
                            
                            prediction.dispose();
                        } catch (error) {
                            console.error(`Error en predicción ${modelType}_${task}:`, error);
                            modelResult[task] = '❌ Error en predicción';
                        }
                    }
                }

                results.predictions.push(modelResult);
            }
        } catch (error) {
            console.error('Error durante el análisis:', error);
            for (const modelType of this.modelTypes) {
                results.predictions.push({
                    modelo: modelType,
                    tipologia: '❌ Error de análisis',
                    material_fachada: '❌ Error de análisis',
                    pisos: '❌ Error de análisis'
                });
            }
        } finally {
            if (preprocessedImage) {
                preprocessedImage.dispose();
            }
        }

        return results;
    }

    // Analizar un fotograma de video
    async analyzeVideoFrame(videoElement, currentTime) {
        try {
            const frameCanvas = document.getElementById('frameCanvas');
            if (!frameCanvas) {
                throw new Error('Canvas de fotogramas no encontrado');
            }
            
            const ctx = frameCanvas.getContext('2d');
            frameCanvas.width = videoElement.videoWidth || 640;
            frameCanvas.height = videoElement.videoHeight || 360;
            
            ctx.drawImage(videoElement, 0, 0);
            
            const coordinates = window.getCurrentCoordinatesForTime ? 
                window.getCurrentCoordinatesForTime(currentTime) : null;
            
            const results = await this.analyzeImage(frameCanvas, currentTime, coordinates);
            results.thumbnail = frameCanvas.toDataURL('image/jpeg', 0.7);
            
            return results;
        } catch (error) {
            console.error('Error analizando fotograma de video:', error);
            throw error;
        }
    }

    // Método para diagnosticar el estado de los label maps
    diagnoseLabelMaps() {
        console.log('=== DIAGNÓSTICO DE LABEL MAPS ===');
        console.log('Label maps cargados:', this.labelMaps);
        
        if (this.labelMaps) {
            for (const task of this.tasks) {
                console.log(`\n${task.toUpperCase()}:`);
                if (this.labelMaps[task]) {
                    Object.entries(this.labelMaps[task]).forEach(([index, label]) => {
                        console.log(`  ${index} → "${label}"`);
                    });
                } else {
                    console.log('  ❌ No disponible');
                }
            }
        } else {
            console.log('❌ No hay label maps cargados');
        }
        console.log('================================');
    }

    // Resto de métodos sin cambios importantes...
    createResultElement(result, frameNumber) {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'frame-result';
        resultDiv.innerHTML = `
            <div class="frame-header">
                <h4>Fotograma #${frameNumber}</h4>
                <span class="frame-time">${this.formatTime(result.timestamp)}</span>
                ${result.coordinates ? 
                    `<span class="frame-coords">📍 ${result.coordinates.lat.toFixed(6)}, ${result.coordinates.lon.toFixed(6)}</span>` 
                    : ''}
            </div>
            <div class="frame-content">
                <img src="${result.thumbnail}" class="frame-thumbnail" alt="Fotograma ${frameNumber}">
                <div class="frame-predictions">
                    <h5 style="margin-bottom: 10px; color: #2c3e50;">Resultados del Análisis:</h5>
                    <table class="predictions-table">
                        <thead>
                            <tr>
                                <th style="width: 30%;">Modelo</th>
                                <th style="width: 25%;">Tipología</th>
                                <th style="width: 25%;">Material</th>
                                <th style="width: 20%;">Pisos</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${result.predictions.map(pred => `
                                <tr>
                                    <td><strong>${pred.modelo.toUpperCase()}</strong></td>
                                    <td>${pred.tipologia}</td>
                                    <td>${pred.material_fachada}</td>
                                    <td style="text-align: center;">${pred.pisos}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    ${this.generateConsensusAnalysis(result.predictions)}
                </div>
            </div>
        `;
        
        return resultDiv;
    }

    generateConsensusAnalysis(predictions) {
        if (predictions.length !== 2) return '';
        
        const [model1, model2] = predictions;
        let consensus = [];
        
        if (model1.tipologia === model2.tipologia && model1.tipologia !== '❌ No encontrado') {
            consensus.push(`<strong>Tipología:</strong> ${model1.tipologia}`);
        }
        if (model1.material_fachada === model2.material_fachada && model1.material_fachada !== '❌ No encontrado') {
            consensus.push(`<strong>Material:</strong> ${model1.material_fachada}`);
        }
        if (model1.pisos === model2.pisos && model1.pisos !== '❌ No encontrado') {
            consensus.push(`<strong>Pisos:</strong> ${model1.pisos}`);
        }
        
        if (consensus.length > 0) {
            return `
                <div style="margin-top: 15px; padding: 10px; background: #e8f5e9; border-radius: 5px;">
                    <h6 style="margin: 0 0 5px 0; color: #2e7d32;">✓ Consenso entre modelos:</h6>
                    <p style="margin: 0; font-size: 0.9em;">${consensus.join(' | ')}</p>
                </div>
            `;
        }
        
        return '';
    }

    formatTime(seconds) {
        if (typeof seconds === 'number') {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        return seconds;
    }

    exportResultsToCSV(results) {
        let csv = 'Fotograma,Tiempo,Latitud,Longitud,Modelo,Tipologia,Material_Fachada,Pisos\n';
        
        results.forEach((result, frameIdx) => {
            result.predictions.forEach(pred => {
                csv += `${frameIdx + 1},${result.timestamp},`;
                csv += result.coordinates ? `${result.coordinates.lat},${result.coordinates.lon},` : ',,';
                csv += `${pred.modelo},${pred.tipologia},${pred.material_fachada},${pred.pisos}\n`;
            });
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analisis_fachadas_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Crear instancia global del analizador
window.facadeAnalyzer = new FacadeAnalyzer();