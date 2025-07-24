// video-processor.js - Módulo para procesar videos 360 y extraer fotogramas

class VideoProcessor {
    constructor() {
        this.isProcessing = false;
        this.isPaused = false;
        this.currentVideo = null;
        this.frameInterval = 5; // segundos entre fotogramas
        this.processedFrames = 0;
        this.results = [];
        this.processingTimer = null;
    }

    // Inicializar el procesador con un elemento de video
    initialize(videoElement) {
        this.currentVideo = videoElement;
        this.setupControls();
        this.reset();
    }

    // Configurar controles de procesamiento
    setupControls() {
        const startBtn = document.getElementById('startProcessing');
        const pauseBtn = document.getElementById('pauseProcessing');
        const intervalInput = document.getElementById('frameInterval');

        if (startBtn) {
            startBtn.addEventListener('click', () => this.startProcessing());
        }

        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => this.togglePause());
        }

        if (intervalInput) {
            intervalInput.addEventListener('change', (e) => {
                this.frameInterval = parseInt(e.target.value) || 5;
            });
        }
    }

    // Resetear el procesador
    reset() {
        this.isProcessing = false;
        this.isPaused = false;
        this.processedFrames = 0;
        this.results = [];
        
        if (this.processingTimer) {
            clearInterval(this.processingTimer);
            this.processingTimer = null;
        }

        this.updateUI();
    }

    // Iniciar procesamiento del video
    async startProcessing() {
        if (!this.currentVideo || !window.facadeAnalyzer || !window.facadeAnalyzer.modelsLoaded) {
            alert('El sistema no está listo. Asegúrese de que el video y los modelos estén cargados.');
            return;
        }

        // Resetear si ya estaba procesando
        if (this.isProcessing) {
            this.reset();
        }

        this.isProcessing = true;
        this.isPaused = false;

        // Actualizar UI
        document.getElementById('startProcessing').textContent = 'Detener Análisis';
        document.getElementById('startProcessing').classList.add('active');
        document.getElementById('pauseProcessing').disabled = false;
        document.getElementById('processingStatus').style.display = 'block';

        // Mostrar sección de resultados
        const resultsContainer = document.getElementById('analysisResults');
        resultsContainer.innerHTML = '<div class="processing-message">Procesando video...</div>';

        // Iniciar el procesamiento
        await this.processVideo();
    }

    // Procesar el video completo
    async processVideo() {
        const videoDuration = this.currentVideo.duration;
        let currentTime = 0;

        // Función para procesar un fotograma
        const processFrame = async () => {
            if (!this.isProcessing) {
                this.finishProcessing();
                return;
            }

            if (this.isPaused) {
                return;
            }

            if (currentTime >= videoDuration) {
                this.finishProcessing();
                return;
            }

            try {
                // Establecer el tiempo del video
                this.currentVideo.currentTime = currentTime;

                // Esperar a que el video se actualice
                await new Promise(resolve => {
                    const seekHandler = () => {
                        this.currentVideo.removeEventListener('seeked', seekHandler);
                        resolve();
                    };
                    this.currentVideo.addEventListener('seeked', seekHandler);
                });

                // Analizar el fotograma actual
                const result = await window.facadeAnalyzer.analyzeVideoFrame(
                    this.currentVideo, 
                    currentTime
                );

                // Guardar resultado
                this.results.push(result);
                this.processedFrames++;

                // Actualizar UI
                this.updateUI();
                this.addResultToUI(result, this.processedFrames);

                // Avanzar al siguiente fotograma
                currentTime += this.frameInterval;

                // Continuar con el siguiente fotograma
                setTimeout(processFrame, 100); // Pequeña pausa para no bloquear la UI

            } catch (error) {
                console.error('Error procesando fotograma:', error);
                currentTime += this.frameInterval;
                setTimeout(processFrame, 100);
            }
        };

        // Iniciar el procesamiento
        processFrame();
    }

    // Pausar/reanudar procesamiento
    togglePause() {
        this.isPaused = !this.isPaused;
        
        const pauseBtn = document.getElementById('pauseProcessing');
        if (pauseBtn) {
            pauseBtn.textContent = this.isPaused ? 'Reanudar' : 'Pausar';
            pauseBtn.classList.toggle('paused', this.isPaused);
        }

        const stateSpan = document.getElementById('processingState');
        if (stateSpan) {
            stateSpan.textContent = this.isPaused ? 'Pausado' : 'Procesando';
        }
    }

    // Finalizar procesamiento
    finishProcessing() {
        this.isProcessing = false;
        
        // Actualizar UI
        document.getElementById('startProcessing').textContent = 'Iniciar Análisis';
        document.getElementById('startProcessing').classList.remove('active');
        document.getElementById('pauseProcessing').disabled = true;

        const stateSpan = document.getElementById('processingState');
        if (stateSpan) {
            stateSpan.textContent = 'Completado';
        }

        // Agregar botón de exportación si hay resultados
        if (this.results.length > 0) {
            this.addExportButton();
        }

        // Mensaje de finalización
        const resultsContainer = document.getElementById('analysisResults');
        const completionMsg = document.createElement('div');
        completionMsg.className = 'completion-message';
        completionMsg.innerHTML = `
            <p>✓ Análisis completado</p>
            <p>Total de fotogramas procesados: ${this.processedFrames}</p>
        `;
        resultsContainer.insertBefore(completionMsg, resultsContainer.firstChild);
    }

    // Actualizar interfaz de usuario
    updateUI() {
        // Actualizar contador de fotogramas
        const framesSpan = document.getElementById('framesProcessed');
        if (framesSpan) {
            framesSpan.textContent = this.processedFrames;
        }

        // Actualizar tiempo actual
        const timeSpan = document.getElementById('currentVideoTime');
        if (timeSpan && this.currentVideo) {
            const mins = Math.floor(this.currentVideo.currentTime / 60);
            const secs = Math.floor(this.currentVideo.currentTime % 60);
            timeSpan.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }

        // Actualizar estado
        const stateSpan = document.getElementById('processingState');
        if (stateSpan) {
            if (this.isProcessing) {
                stateSpan.textContent = this.isPaused ? 'Pausado' : 'Procesando';
            } else {
                stateSpan.textContent = this.processedFrames > 0 ? 'Completado' : 'Inactivo';
            }
        }
    }

    // Agregar resultado a la interfaz
    addResultToUI(result, frameNumber) {
        const resultsContainer = document.getElementById('analysisResults');
        
        // Limpiar mensaje inicial si existe
        const processingMsg = resultsContainer.querySelector('.processing-message');
        if (processingMsg) {
            processingMsg.remove();
        }

        // Crear elemento de resultado
        const resultElement = window.facadeAnalyzer.createResultElement(result, frameNumber);
        
        // Agregar evento de clic para saltar al fotograma
        resultElement.addEventListener('click', () => {
            if (this.currentVideo && typeof result.timestamp === 'number') {
                this.currentVideo.currentTime = result.timestamp;
                
                // Resaltar el elemento seleccionado
                document.querySelectorAll('.frame-result').forEach(el => {
                    el.classList.remove('selected');
                });
                resultElement.classList.add('selected');
            }
        });

        // Agregar al contenedor
        resultsContainer.appendChild(resultElement);

        // Hacer scroll para mostrar el nuevo resultado
        resultElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Agregar botón de exportación
    addExportButton() {
        const resultsContainer = document.getElementById('analysisResults');
        
        // Verificar si ya existe el botón
        if (resultsContainer.querySelector('.export-button')) {
            return;
        }

        const exportBtn = document.createElement('button');
        exportBtn.className = 'export-button';
        exportBtn.textContent = '📥 Exportar Resultados (CSV)';
        exportBtn.addEventListener('click', () => {
            window.facadeAnalyzer.exportResultsToCSV(this.results);
        });

        resultsContainer.insertBefore(exportBtn, resultsContainer.firstChild);
    }

    // Obtener resultados procesados
    getResults() {
        return this.results;
    }

    // Limpiar resultados
    clearResults() {
        this.results = [];
        this.processedFrames = 0;
        
        const resultsContainer = document.getElementById('analysisResults');
        if (resultsContainer) {
            resultsContainer.innerHTML = '<p class="no-results">No hay resultados aún. Inicie el análisis del video.</p>';
        }

        document.getElementById('processingStatus').style.display = 'none';
        this.updateUI();
    }
}

//