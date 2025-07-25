// video-processor.js - Procesador de video completo con análisis 360° multiperspectiva

class VideoProcessor {
    constructor() {
        this.isProcessing = false;
        this.isPaused = false;
        this.currentVideo = null;
        this.frameInterval = 5; // segundos entre fotogramas
        this.processedFrames = 0;
        this.results = [];
        this.processingTimer = null;
        this.isInitialized = false;
        this.is360Analysis = true; // Flag para determinar si usar análisis 360° o tradicional
        
        console.log('VideoProcessor instanciado correctamente con soporte 360°');
    }

    // Inicializar el procesador con un elemento de video
    initialize(videoElement) {
        try {
            if (!videoElement) {
                console.warn('VideoProcessor: No se proporcionó elemento de video');
                return false;
            }
            
            this.currentVideo = videoElement;
            this.setupControls();
            this.reset();
            this.isInitialized = true;
            
            // Detectar automáticamente si es contenido 360° basado en las dimensiones
            this.detectVideoType();
            
            console.log('VideoProcessor inicializado correctamente con video element');
            return true;
        } catch (error) {
            console.error('Error inicializando VideoProcessor:', error);
            return false;
        }
    }

    // Detectar automáticamente si el video es 360° basado en sus dimensiones
    detectVideoType() {
        const width = this.currentVideo.videoWidth || 1920;
        const height = this.currentVideo.videoHeight || 1080;
        const aspectRatio = width / height;
        
        // Los videos 360° equirectangulares típicamente tienen una relación de aspecto 2:1
        // Ejemplos comunes: 3840x1920, 4096x2048, 1920x960, etc.
        this.is360Analysis = aspectRatio >= 1.8 && aspectRatio <= 2.2;
        
        console.log(`Video detectado: ${width}x${height} (ratio: ${aspectRatio.toFixed(2)}) - Tipo: ${this.is360Analysis ? '360°' : 'tradicional'}`);
        
        // Actualizar UI para indicar el tipo de análisis
        this.updateAnalysisTypeIndicator();
    }

    // Actualizar indicador en la UI del tipo de análisis
    updateAnalysisTypeIndicator() {
        const indicator = document.getElementById('analysisTypeIndicator') || this.createAnalysisTypeIndicator();
        
        if (this.is360Analysis) {
            indicator.innerHTML = '🌐 Análisis 360° Multiperspectiva';
            indicator.className = 'analysis-type-indicator type-360';
            indicator.title = 'Se analizarán 4 perspectivas: frontal, izquierda, derecha y trasera';
        } else {
            indicator.innerHTML = '📹 Análisis Tradicional';
            indicator.className = 'analysis-type-indicator type-traditional';
            indicator.title = 'Se analizará el fotograma completo';
        }
    }

    // Crear indicador del tipo de análisis si no existe
    createAnalysisTypeIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'analysisTypeIndicator';
        indicator.className = 'analysis-type-indicator';
        
        // Insertar después del título del panel de análisis
        const analysisTitle = document.querySelector('.analysis-title');
        if (analysisTitle) {
            analysisTitle.insertAdjacentElement('afterend', indicator);
        }
        
        // Agregar estilos si no existen
        this.addAnalysisTypeStyles();
        
        return indicator;
    }

    // Agregar estilos para el indicador de tipo de análisis
    addAnalysisTypeStyles() {
        if (document.getElementById('analysis-type-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'analysis-type-styles';
        styles.textContent = `
            .analysis-type-indicator {
                padding: 10px 15px;
                margin: 10px 0 20px 0;
                border-radius: 8px;
                font-weight: 600;
                text-align: center;
                font-size: 0.95em;
                cursor: help;
                transition: all 0.3s ease;
            }
            
            .analysis-type-indicator:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            }
            
            .type-360 {
                background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
                color: #1565c0;
                border: 2px solid #2196f3;
            }
            
            .type-traditional {
                background: linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%);
                color: #7b1fa2;
                border: 2px solid #9c27b0;
            }
        `;
        
        document.head.appendChild(styles);
    }

    // Configurar controles de procesamiento con verificación de elementos
    setupControls() {
        try {
            const startBtn = document.getElementById('startProcessing');
            const pauseBtn = document.getElementById('pauseProcessing');
            const intervalInput = document.getElementById('frameInterval');

            if (startBtn) {
                // Remover listeners anteriores para evitar duplicados
                startBtn.removeEventListener('click', this.handleStartClick);
                this.handleStartClick = () => this.startProcessing();
                startBtn.addEventListener('click', this.handleStartClick);
                console.log('Botón de inicio configurado');
            } else {
                console.warn('Botón startProcessing no encontrado');
            }

            if (pauseBtn) {
                pauseBtn.removeEventListener('click', this.handlePauseClick);
                this.handlePauseClick = () => this.togglePause();
                pauseBtn.addEventListener('click', this.handlePauseClick);
                console.log('Botón de pausa configurado');
            } else {
                console.warn('Botón pauseProcessing no encontrado');
            }

            if (intervalInput) {
                intervalInput.removeEventListener('change', this.handleIntervalChange);
                this.handleIntervalChange = (e) => {
                    this.frameInterval = parseInt(e.target.value) || 5;
                    console.log('Intervalo actualizado a:', this.frameInterval);
                };
                intervalInput.addEventListener('change', this.handleIntervalChange);
                console.log('Input de intervalo configurado');
            } else {
                console.warn('Input frameInterval no encontrado');
            }
        } catch (error) {
            console.error('Error configurando controles:', error);
        }
    }

    // Verificar si el sistema está listo para procesar
    isReadyToProcess() {
        if (!this.currentVideo) {
            console.error('No hay elemento de video disponible');
            return false;
        }
        
        if (!window.facadeAnalyzer) {
            console.error('FacadeAnalyzer no está disponible');
            return false;
        }
        
        if (!window.facadeAnalyzer.modelsLoaded) {
            console.error('Los modelos de análisis no están cargados');
            return false;
        }

        // Verificar que el analizador 360° esté disponible si es necesario
        if (this.is360Analysis && !window.enhanced360Analyzer) {
            console.error('Enhanced360Analyzer no está disponible para análisis 360°');
            return false;
        }
        
        return true;
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
        console.log('VideoProcessor reseteado');
    }

    // Iniciar procesamiento del video con validaciones robustas
    async startProcessing() {
        console.log('Intentando iniciar procesamiento...');
        
        // Verificar si el sistema está listo
        if (!this.isReadyToProcess()) {
            const message = 'El sistema no está listo para procesar. Verifique que:\n' +
                          '- El video esté cargado correctamente\n' +
                          '- Los modelos de análisis estén disponibles\n' +
                          (this.is360Analysis ? '- El analizador 360° esté inicializado' : '');
            alert(message);
            return;
        }

        // Si ya está procesando, detener
        if (this.isProcessing) {
            this.stopProcessing();
            return;
        }

        // Verificar duración del video
        if (!this.currentVideo.duration || this.currentVideo.duration === 0) {
            alert('El video no tiene una duración válida. Espere a que termine de cargar.');
            return;
        }

        try {
            this.isProcessing = true;
            this.isPaused = false;

            // Actualizar UI
            this.updateStartButton('Detener Análisis', true);
            this.enablePauseButton(true);
            this.showProcessingStatus(true);

            // Limpiar resultados anteriores
            this.clearResultsDisplay();
            this.showProcessingMessage();

            console.log(`Iniciando procesamiento ${this.is360Analysis ? '360°' : 'tradicional'} de video (duración: ${this.currentVideo.duration}s)`);

            // Iniciar el procesamiento
            await this.processVideo();
            
        } catch (error) {
            console.error('Error durante el procesamiento:', error);
            this.handleProcessingError(error);
        }
    }

    // Detener procesamiento
    stopProcessing() {
        console.log('Deteniendo procesamiento...');
        this.isProcessing = false;
        
        this.updateStartButton('Iniciar Análisis', false);
        this.enablePauseButton(false);
        
        if (this.results.length > 0) {
            this.finishProcessing();
        } else {
            this.updateProcessingState('Detenido');
        }
    }

    // Procesar el video completo con manejo robusto de errores
    async processVideo() {
        const videoDuration = this.currentVideo.duration;
        let currentTime = 0;
        let consecutiveErrors = 0;
        const maxConsecutiveErrors = 3;

        console.log(`Procesando video desde 0 hasta ${videoDuration} segundos`);

        // Función para procesar un fotograma
        const processFrame = async () => {
            if (!this.isProcessing) {
                this.finishProcessing();
                return;
            }

            if (this.isPaused) {
                // Si está pausado, esperar y revisar de nuevo
                setTimeout(processFrame, 500);
                return;
            }

            if (currentTime >= videoDuration) {
                console.log('Procesamiento completado - fin del video alcanzado');
                this.finishProcessing();
                return;
            }

            try {
                console.log(`Procesando fotograma en tiempo: ${currentTime}s`);
                
                // Establecer el tiempo del video
                this.currentVideo.currentTime = currentTime;

                // Esperar a que el video se actualice
                await this.waitForVideoSeek();

                // Verificar que el frame esté listo
                if (this.currentVideo.readyState < 2) {
                    console.warn('Video no está listo, saltando frame');
                    currentTime += this.frameInterval;
                    setTimeout(processFrame, 100);
                    return;
                }

                // Analizar el fotograma usando el método apropiado (360° o tradicional)
                let result;
                if (this.is360Analysis && window.enhanced360Analyzer) {
                    console.log('Usando análisis 360° multiperspectiva');
                    result = await window.enhanced360Analyzer.analyzeVideoFrame360(
                        this.currentVideo, 
                        currentTime
                    );
                } else {
                    console.log('Usando análisis tradicional');
                    // Análisis tradicional (fotograma completo)
                    result = await window.facadeAnalyzer.analyzeVideoFrame(
                        this.currentVideo, 
                        currentTime
                    );
                }

                // Guardar resultado
                this.results.push(result);
                this.processedFrames++;
                consecutiveErrors = 0; // Reset counter on success

                // Actualizar UI
                this.updateUI();
                this.addResultToUI(result, this.processedFrames);

                // Avanzar al siguiente fotograma
                currentTime += this.frameInterval;

                // Continuar con el siguiente fotograma
                setTimeout(processFrame, 200); // Pausa más larga para estabilidad

            } catch (error) {
                console.error('Error procesando fotograma:', error);
                consecutiveErrors++;
                
                if (consecutiveErrors >= maxConsecutiveErrors) {
                    console.error('Demasiados errores consecutivos, deteniendo procesamiento');
                    this.handleProcessingError(new Error('Demasiados errores consecutivos'));
                    return;
                }
                
                // Avanzar al siguiente fotograma y continuar
                currentTime += this.frameInterval;
                setTimeout(processFrame, 200);
            }
        };

        // Iniciar el procesamiento
        processFrame();
    }

    // Esperar a que el video haga seek correctamente
    waitForVideoSeek() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.currentVideo.removeEventListener('seeked', seekHandler);
                reject(new Error('Timeout esperando seek del video'));
            }, 5000); // 5 segundos de timeout

            const seekHandler = () => {
                clearTimeout(timeout);
                this.currentVideo.removeEventListener('seeked', seekHandler);
                resolve();
            };

            this.currentVideo.addEventListener('seeked', seekHandler);
        });
    }

    // Pausar/reanudar procesamiento
    togglePause() {
        this.isPaused = !this.isPaused;
        
        const pauseBtn = document.getElementById('pauseProcessing');
        if (pauseBtn) {
            pauseBtn.textContent = this.isPaused ? 'Reanudar' : 'Pausar';
            pauseBtn.classList.toggle('paused', this.isPaused);
        }

        this.updateProcessingState(this.isPaused ? 'Pausado' : 'Procesando');
        console.log(`Procesamiento ${this.isPaused ? 'pausado' : 'reanudado'}`);
    }

    // Finalizar procesamiento
    finishProcessing() {
        this.isProcessing = false;
        
        console.log(`Procesamiento ${this.is360Analysis ? '360°' : 'tradicional'} finalizado. Total de fotogramas: ${this.processedFrames}`);
        
        // Actualizar UI
        this.updateStartButton('Iniciar Análisis', false);
        this.enablePauseButton(false);
        this.updateProcessingState('Completado');

        // Agregar botón de exportación si hay resultados
        if (this.results.length > 0) {
            this.addExportButton();
            this.showCompletionMessage();
        }
    }

    // Manejar errores de procesamiento
    handleProcessingError(error) {
        this.isProcessing = false;
        
        console.error('Error en procesamiento:', error);
        
        this.updateStartButton('Iniciar Análisis', false);
        this.enablePauseButton(false);
        this.updateProcessingState('Error');
        
        const resultsContainer = document.getElementById('analysisResults');
        if (resultsContainer) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.style.cssText = 'background: #fee; color: #c33; padding: 15px; border-radius: 8px; margin: 10px 0;';
            errorDiv.innerHTML = `
                <p><strong>Error durante el procesamiento ${this.is360Analysis ? '360°' : 'tradicional'}:</strong></p>
                <p>${error.message}</p>
                <p>Fotogramas procesados antes del error: ${this.processedFrames}</p>
            `;
            resultsContainer.insertBefore(errorDiv, resultsContainer.firstChild);
        }
    }

    // Agregar resultado a la interfaz usando el método apropiado
    addResultToUI(result, frameNumber) {
        const resultsContainer = document.getElementById('analysisResults');
        if (!resultsContainer) return;
        
        try {
            // Limpiar mensaje inicial si existe
            const processingMsg = resultsContainer.querySelector('.processing-message');
            if (processingMsg) {
                processingMsg.remove();
            }

            // Crear elemento de resultado usando el método apropiado
            let resultElement;
            if (this.is360Analysis && window.enhanced360Analyzer && result.perspectives) {
                // Usar el visualizador 360° mejorado
                console.log('Creando resultado 360° con', result.perspectives.length, 'perspectivas');
                resultElement = window.enhanced360Analyzer.createEnhanced360Result(result, frameNumber);
            } else {
                // Usar el visualizador tradicional
                console.log('Creando resultado tradicional');
                resultElement = window.facadeAnalyzer.createResultElement(result, frameNumber);
            }
            
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
            
        } catch (error) {
            console.error('Error agregando resultado a UI:', error);
        }
    }

    // Agregar botón de exportación
    addExportButton() {
        const resultsContainer = document.getElementById('analysisResults');
        if (!resultsContainer) return;
        
        // Verificar si ya existe el botón
        if (resultsContainer.querySelector('.export-button')) {
            return;
        }

        const exportBtn = document.createElement('button');
        exportBtn.className = 'export-button';
        exportBtn.textContent = this.is360Analysis ? 
            '📥 Exportar Resultados 360° (CSV)' : 
            '📥 Exportar Resultados (CSV)';
        
        exportBtn.addEventListener('click', () => {
            try {
                if (this.is360Analysis && window.enhanced360Analyzer) {
                    window.enhanced360Analyzer.exportResults360ToCSV(this.results);
                } else {
                    window.facadeAnalyzer.exportResultsToCSV(this.results);
                }
            } catch (error) {
                console.error('Error exportando resultados:', error);
                alert('Error al exportar los resultados');
            }
        });

        resultsContainer.insertBefore(exportBtn, resultsContainer.firstChild);
    }

    // Métodos auxiliares para actualizar la UI
    updateStartButton(text, isActive) {
        const startBtn = document.getElementById('startProcessing');
        if (startBtn) {
            startBtn.textContent = text;
            startBtn.classList.toggle('active', isActive);
        }
    }

    enablePauseButton(enabled) {
        const pauseBtn = document.getElementById('pauseProcessing');
        if (pauseBtn) {
            pauseBtn.disabled = !enabled;
            if (!enabled) {
                pauseBtn.textContent = 'Pausar';
                pauseBtn.classList.remove('paused');
            }
        }
    }

    showProcessingStatus(show) {
        const statusElement = document.getElementById('processingStatus');
        if (statusElement) {
            statusElement.style.display = show ? 'block' : 'none';
        }
    }

    updateProcessingState(state) {
        const stateSpan = document.getElementById('processingState');
        if (stateSpan) {
            stateSpan.textContent = state;
        }
    }

    // Mostrar mensaje de procesamiento apropiado
    showProcessingMessage() {
        const resultsContainer = document.getElementById('analysisResults');
        if (resultsContainer) {
            const message = this.is360Analysis ? 
                '🌐 Procesando video 360° - Analizando múltiples perspectivas...' :
                '🔄 Procesando video tradicional...';
            resultsContainer.innerHTML = `<div class="processing-message">${message}</div>`;
        }
    }

    clearResultsDisplay() {
        const resultsContainer = document.getElementById('analysisResults');
        if (resultsContainer) {
            // Mantener solo los elementos de control, limpiar resultados
            const controlElements = resultsContainer.querySelectorAll('.export-button, .completion-message, .error-message');
            controlElements.forEach(el => el.remove());
        }
    }

    // Mostrar mensaje de finalización
    showCompletionMessage() {
        const resultsContainer = document.getElementById('analysisResults');
        if (resultsContainer) {
            const completionMsg = document.createElement('div');
            completionMsg.className = 'completion-message';
            
            const perspectiveInfo = this.is360Analysis ? 
                `<p>Perspectivas analizadas: ${this.results[0]?.perspectives?.length || 4} por fotograma</p>` :
                '';
            
            completionMsg.innerHTML = `
                <p>✅ Análisis ${this.is360Analysis ? '360°' : 'tradicional'} completado exitosamente</p>
                <p>Total de fotogramas procesados: ${this.processedFrames}</p>
                ${perspectiveInfo}
                <p>Resultados disponibles para exportar</p>
            `;
            resultsContainer.insertBefore(completionMsg, resultsContainer.firstChild);
        }
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
        if (this.isProcessing) {
            this.updateProcessingState(this.isPaused ? 'Pausado' : 'Procesando');
        }
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
            const noResultsMessage = this.is360Analysis ? 
                'No hay resultados aún. Inicie el análisis 360° del video.' :
                'No hay resultados aún. Inicie el análisis del video.';
            resultsContainer.innerHTML = `<p class="no-results">${noResultsMessage}</p>`;
        }

        this.showProcessingStatus(false);
        this.updateUI();
        
        console.log('Resultados limpiados');
    }

    // Método para verificar el estado del procesador
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isProcessing: this.isProcessing,
            isPaused: this.isPaused,
            processedFrames: this.processedFrames,
            hasVideo: !!this.currentVideo,
            frameInterval: this.frameInterval,
            is360Analysis: this.is360Analysis,
            videoResolution: this.currentVideo ? 
                `${this.currentVideo.videoWidth}x${this.currentVideo.videoHeight}` : 
                'No disponible'
        };
    }

    // Método para forzar el tipo de análisis (útil para debugging)
    setAnalysisType(is360) {
        this.is360Analysis = is360;
        this.updateAnalysisTypeIndicator();
        console.log(`Tipo de análisis cambiado a: ${is360 ? '360°' : 'tradicional'}`);
    }

    // Método para obtener información detallada del video
    getVideoInfo() {
        if (!this.currentVideo) return null;
        
        return {
            width: this.currentVideo.videoWidth,
            height: this.currentVideo.videoHeight,
            duration: this.currentVideo.duration,
            aspectRatio: (this.currentVideo.videoWidth / this.currentVideo.videoHeight).toFixed(2),
            detectedAs360: this.is360Analysis,
            readyState: this.currentVideo.readyState,
            currentTime: this.currentVideo.currentTime
        };
    }
}

// Asegurar que la clase esté disponible globalmente inmediatamente
if (typeof window !== 'undefined') {
    window.VideoProcessor = VideoProcessor;
    console.log('VideoProcessor class registrada globalmente con soporte 360° completo');
}