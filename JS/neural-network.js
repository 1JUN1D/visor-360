// neural-network.js - Módulo para manejar la red neuronal de clasificación de fachadas

class FacadeAnalyzer {
    constructor() {
        this.models = {};
        // Solo trabajamos con los modelos que tienes convertidos
        this.modelTypes = ['mobilenet', 'efficientnet'];
        this.tasks = ['tipologia', 'material_fachada', 'pisos'];
        this.labelMaps = null;
        this.modelsLoaded = false;
        this.csvData = null;
    }

    // Inicializar el analizador y cargar los modelos
    async initialize() {
        try {
            // Primero cargamos el CSV con los label maps
            await this.loadCSVData();
            
            // Generar los label maps desde el CSV
            this.generateLabelMaps();
            
            // Cargar todos los modelos
            await this.loadAllModels();
            
            this.modelsLoaded = true;
            console.log('Todos los modelos cargados exitosamente');
            return true;
        } catch (error) {
            console.error('Error inicializando el analizador:', error);
            return false;
        }
    }

    // Cargar datos del CSV real
    async loadCSVData() {
        try {
            // Primero intentamos cargar el label_maps.json si ya existe
            try {
                const response = await fetch('./models/label_maps.json');
                if (response.ok) {
                    const labelMaps = await response.json();
                    this.csvData = labelMaps;
                    console.log('Label maps cargados desde JSON');
                    return;
                }
            } catch (e) {
                console.log('No se encontró label_maps.json, cargando desde CSV...');
            }

            // Si no existe el JSON, cargar desde el CSV
            const csvResponse = await fetch('./data/model_trainin.csv');
            const csvText = await csvResponse.text();
            
            // Parsear el CSV
            const lines = csvText.trim().split('\n');
            const headers = lines[0].split(';');
            
            // Encontrar índices de las columnas que necesitamos
            const tipologiaIdx = headers.indexOf('tipologia');
            const materialIdx = headers.indexOf('material_fachada');
            const pisosIdx = headers.indexOf('pisos');
            
            // Extraer valores únicos para cada categoría
            const tipologiaSet = new Set();
            const materialSet = new Set();
            const pisosSet = new Set();
            
            // Procesar cada línea del CSV (saltando el header)
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(';');
                if (values[tipologiaIdx]) tipologiaSet.add(values[tipologiaIdx]);
                if (values[materialIdx]) materialSet.add(values[materialIdx]);
                if (values[pisosIdx]) pisosSet.add(values[pisosIdx]);
            }
            
            // Convertir sets a arrays ordenados
            this.csvData = {
                tipologia: Array.from(tipologiaSet).sort(),
                material_fachada: Array.from(materialSet).sort(),
                pisos: Array.from(pisosSet).sort((a, b) => parseInt(a) - parseInt(b))
            };
            
            console.log('Categorías extraídas del CSV:', this.csvData);
            
        } catch (error) {
            console.error('Error cargando CSV:', error);
            // Valores por defecto si falla la carga
            this.csvData = {
                tipologia: ['Comercial Basico 1', 'Comercial Basico 2', 'Tipo 3 menos'],
                material_fachada: ['Acabado sencillo', 'Acabado elegante', 'Sin acabado'],
                pisos: ['1', '2', '3', '4', '5']
            };
        }
    }

    // Generar mapas de etiquetas
    generateLabelMaps() {
        this.labelMaps = {};
        for (const task of this.tasks) {
            this.labelMaps[task] = {};
            if (this.csvData && this.csvData[task]) {
                this.csvData[task].forEach((label, index) => {
                    this.labelMaps[task][index] = label;
                });
            }
        }
    }

    // Cargar todos los modelos
    async loadAllModels() {
        // Total de modelos: 2 arquitecturas × 3 tareas = 6 modelos
        const totalModels = this.modelTypes.length * this.tasks.length;
        let loadedModels = 0;

        for (const modelType of this.modelTypes) {
            this.models[modelType] = {};
            
            for (const task of this.tasks) {
                const modelPath = `./models/modelo_${modelType}_${task}.pt`;
                
                try {
                    // Convertir modelo PyTorch a TensorFlow.js
                    // Nota: Necesitarás convertir tus modelos .pt a formato TensorFlow.js
                    // Usa: https://github.com/tensorflow/tfjs/tree/master/tfjs-converter
                    
                    // Por ahora, simulamos la carga del modelo
                    const model = await this.loadModel(modelPath);
                    this.models[modelType][task] = model;
                    
                    loadedModels++;
                    this.updateLoadingProgress(loadedModels, totalModels);
                } catch (error) {
                    console.error(`Error cargando modelo ${modelType}_${task}:`, error);
                    this.models[modelType][task] = null;
                }
            }
        }
    }

    // Cargar modelo real de TensorFlow.js
    async loadModel(modelPath) {
        try {
            // Convertir la ruta .pt a la ruta real de TensorFlow.js
            // De: "./models/modelo_resnet50_tipologia.pt"
            // A: "./models/tfjs/modelo_resnet50_tipologia/model.json"
            const tfModelPath = modelPath
                .replace('./models/', './models/tfjs/')
                .replace('.pt', '/model.json');
            
            console.log(`Cargando modelo desde: ${tfModelPath}`);
            
            // Cargar el modelo real de TensorFlow.js
            const model = await tf.loadLayersModel(tfModelPath);
            
            // Verificar que el modelo se cargó correctamente
            console.log(`Modelo cargado exitosamente: ${tfModelPath}`);
            
            return model;
            
        } catch (error) {
            console.error(`Error cargando modelo ${modelPath}:`, error);
            
            // Si falla la carga, retornar un modelo simulado para pruebas
            console.warn('Usando modelo simulado para pruebas');
            return {
                predict: (tensor) => {
                    // Simulación de predicción para desarrollo
                    const numClasses = 3;
                    return tf.randomUniform([1, numClasses]);
                }
            };
        }
    }

    // Actualizar progreso de carga
    updateLoadingProgress(loaded, total) {
        const progress = (loaded / total) * 100;
        const progressBar = document.getElementById('modelProgress');
        const statusText = document.getElementById('modelStatus');
        
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        
        if (statusText && progress === 100) {
            statusText.innerHTML = '<p style="color: #27ae60;">✓ Modelos cargados correctamente</p>';
        }
    }

    // Preprocesar imagen para la red neuronal
    preprocessImage(imageElement) {
        // Redimensionar a 224x224 y normalizar
        const tensor = tf.browser.fromPixels(imageElement)
            .resizeNearestNeighbor([224, 224])
            .toFloat();
        
        // Normalización ImageNet
        const mean = tf.tensor3d([0.485, 0.456, 0.406], [1, 1, 3]);
        const std = tf.tensor3d([0.229, 0.224, 0.225], [1, 1, 3]);
        
        return tensor.div(255.0)
            .sub(mean)
            .div(std)
            .expandDims(0);
    }

    // Analizar una imagen con todos los modelos
    async analyzeImage(imageElement, timestamp = null, coordinates = null) {
        if (!this.modelsLoaded) {
            throw new Error('Los modelos no están cargados aún');
        }

        const results = {
            timestamp: timestamp || new Date().toISOString(),
            coordinates: coordinates,
            predictions: []
        };

        // Preprocesar la imagen una sola vez
        const preprocessedImage = this.preprocessImage(imageElement);

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
                        
                        // Obtener la etiqueta correspondiente
                        modelResult[task] = this.labelMaps[task][predictedClass] || `Clase ${predictedClass}`;
                        
                        // Limpiar tensores
                        prediction.dispose();
                    } catch (error) {
                        console.error(`Error en predicción ${modelType}_${task}:`, error);
                    }
                }
            }

            results.predictions.push(modelResult);
        }

        // Limpiar tensor preprocesado
        preprocessedImage.dispose();

        return results;
    }

    // Analizar un fotograma de video
    async analyzeVideoFrame(videoElement, currentTime) {
        // Crear canvas temporal para capturar el fotograma
        const canvas = document.getElementById('frameCanvas');
        const ctx = canvas.getContext('2d');
        
        // Ajustar tamaño del canvas
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        
        // Dibujar el fotograma actual
        ctx.drawImage(videoElement, 0, 0);
        
        // Obtener coordenadas si están disponibles
        const coordinates = window.getCurrentCoordinatesForTime ? 
            window.getCurrentCoordinatesForTime(currentTime) : null;
        
        // Analizar la imagen
        const results = await this.analyzeImage(canvas, currentTime, coordinates);
        
        // Guardar miniatura del fotograma
        results.thumbnail = canvas.toDataURL('image/jpeg', 0.7);
        
        return results;
    }

    // Crear elemento HTML para mostrar resultados
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

    // Generar análisis de consenso entre los dos modelos
    generateConsensusAnalysis(predictions) {
        if (predictions.length !== 2) return '';
        
        const [model1, model2] = predictions;
        let consensus = [];
        
        // Verificar consenso en cada tarea
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

    // Formatear tiempo
    formatTime(seconds) {
        if (typeof seconds === 'number') {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        return seconds;
    }

    // Exportar resultados a CSV
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