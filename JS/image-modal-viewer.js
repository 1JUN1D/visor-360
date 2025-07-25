// image-modal-viewer.js - Visor modal para imágenes de análisis con funcionalidad completa

class ImageModalViewer {
    constructor() {
        this.modal = null;
        this.currentImages = [];
        this.currentIndex = 0;
        this.isVisible = false;
        
        this.createModalStructure();
        this.setupEventListeners();
        
        console.log('ImageModalViewer inicializado correctamente');
    }

    // Crear la estructura HTML del modal
    createModalStructure() {
        // Crear el contenedor principal del modal
        this.modal = document.createElement('div');
        this.modal.id = 'imageModal';
        this.modal.className = 'image-modal';
        
        // Estructura HTML del modal con todos los controles
        this.modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-container">
                <div class="modal-header">
                    <div class="modal-title">
                        <span class="image-title">Vista de Fotograma</span>
                        <span class="image-counter">1 / 1</span>
                    </div>
                    <button class="modal-close" aria-label="Cerrar">✕</button>
                </div>
                
                <div class="modal-body">
                    <div class="image-navigation">
                        <button class="nav-button nav-prev" aria-label="Imagen anterior">‹</button>
                        <div class="image-container">
                            <img class="modal-image" src="" alt="Imagen expandida">
                            <div class="image-info">
                                <span class="image-description"></span>
                            </div>
                        </div>
                        <button class="nav-button nav-next" aria-label="Imagen siguiente">›</button>
                    </div>
                    
                    <div class="image-thumbnails">
                        <!-- Las miniaturas se generarán dinámicamente -->
                    </div>
                </div>
                
                <div class="modal-footer">
                    <div class="image-actions">
                        <button class="action-button download-btn">
                            📥 Descargar
                        </button>
                        <button class="action-button fullscreen-btn">
                            🔍 Pantalla Completa
                        </button>
                        <button class="action-button info-btn">
                            ℹ️ Información
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Agregar al DOM pero mantenerlo oculto inicialmente
        document.body.appendChild(this.modal);
        
        // Agregar estilos CSS para el modal
        this.addModalStyles();
    }

    // Configurar todos los event listeners del modal
    setupEventListeners() {
        // Cerrar modal con el botón X
        this.modal.querySelector('.modal-close').addEventListener('click', () => {
            this.closeModal();
        });

        // Cerrar modal al hacer clic en el backdrop
        this.modal.querySelector('.modal-backdrop').addEventListener('click', () => {
            this.closeModal();
        });

        // Navegación con botones de flecha
        this.modal.querySelector('.nav-prev').addEventListener('click', () => {
            this.showPreviousImage();
        });

        this.modal.querySelector('.nav-next').addEventListener('click', () => {
            this.showNextImage();
        });

        // Botones de acción
        this.modal.querySelector('.download-btn').addEventListener('click', () => {
            this.downloadCurrentImage();
        });

        this.modal.querySelector('.fullscreen-btn').addEventListener('click', () => {
            this.toggleFullscreen();
        });

        this.modal.querySelector('.info-btn').addEventListener('click', () => {
            this.showImageInfo();
        });

        // Navegación con teclado
        document.addEventListener('keydown', (e) => {
            if (!this.isVisible) return;
            
            switch(e.key) {
                case 'Escape':
                    this.closeModal();
                    break;
                case 'ArrowLeft':
                    this.showPreviousImage();
                    break;
                case 'ArrowRight':
                    this.showNextImage();
                    break;
                case 'f':
                case 'F':
                    this.toggleFullscreen();
                    break;
            }
        });

        // Prevenir scroll del body cuando el modal está abierto
        this.modal.addEventListener('wheel', (e) => {
            e.stopPropagation();
        });
    }

    // Abrir modal con una imagen específica
    openModal(imageData, allImages = null, startIndex = 0) {
        // Si se pasa un array de imágenes, usar eso; sino, crear array con una imagen
        this.currentImages = allImages || [imageData];
        this.currentIndex = startIndex;
        
        // Mostrar el modal
        this.modal.style.display = 'flex';
        this.isVisible = true;
        
        // Prevenir scroll del body
        document.body.style.overflow = 'hidden';
        
        // Actualizar contenido del modal
        this.updateModalContent();
        this.generateThumbnails();
        
        // Animación de entrada
        setTimeout(() => {
            this.modal.classList.add('visible');
        }, 10);
        
        console.log('Modal abierto con', this.currentImages.length, 'imágenes');
    }

    // Cerrar el modal
    closeModal() {
        this.modal.classList.remove('visible');
        
        // Esperar a que termine la animación antes de ocultar
        setTimeout(() => {
            this.modal.style.display = 'none';
            this.isVisible = false;
            document.body.style.overflow = 'auto';
        }, 300);
    }

    // Actualizar el contenido del modal con la imagen actual
    updateModalContent() {
        const currentImage = this.currentImages[this.currentIndex];
        const modalImage = this.modal.querySelector('.modal-image');
        const imageTitle = this.modal.querySelector('.image-title');
        const imageCounter = this.modal.querySelector('.image-counter');
        const imageDescription = this.modal.querySelector('.image-description');
        
        // Actualizar imagen principal
        modalImage.src = currentImage.src;
        modalImage.alt = currentImage.alt || 'Imagen de análisis';
        
        // Actualizar título y contador
        imageTitle.textContent = currentImage.title || 'Vista de Fotograma';
        imageCounter.textContent = `${this.currentIndex + 1} / ${this.currentImages.length}`;
        
        // Actualizar descripción
        imageDescription.textContent = currentImage.description || '';
        
        // Actualizar estado de los botones de navegación
        const prevBtn = this.modal.querySelector('.nav-prev');
        const nextBtn = this.modal.querySelector('.nav-next');
        
        prevBtn.style.display = this.currentImages.length > 1 ? 'block' : 'none';
        nextBtn.style.display = this.currentImages.length > 1 ? 'block' : 'none';
        
        prevBtn.disabled = this.currentIndex === 0;
        nextBtn.disabled = this.currentIndex === this.currentImages.length - 1;
        
        // Actualizar miniaturas activas
        this.updateActiveThumbnail();
    }

    // Generar miniaturas para navegación rápida
    generateThumbnails() {
        const thumbnailsContainer = this.modal.querySelector('.image-thumbnails');
        thumbnailsContainer.innerHTML = '';
        
        // Solo mostrar miniaturas si hay más de una imagen
        if (this.currentImages.length <= 1) {
            thumbnailsContainer.style.display = 'none';
            return;
        }
        
        thumbnailsContainer.style.display = 'flex';
        
        this.currentImages.forEach((imageData, index) => {
            const thumbnail = document.createElement('div');
            thumbnail.className = 'thumbnail-item';
            thumbnail.innerHTML = `
                <img src="${imageData.src}" alt="${imageData.alt || 'Miniatura'}">
                <span class="thumbnail-label">${imageData.shortTitle || index + 1}</span>
            `;
            
            // Agregar evento de clic para navegar
            thumbnail.addEventListener('click', () => {
                this.currentIndex = index;
                this.updateModalContent();
            });
            
            thumbnailsContainer.appendChild(thumbnail);
        });
    }

    // Actualizar miniatura activa
    updateActiveThumbnail() {
        const thumbnails = this.modal.querySelectorAll('.thumbnail-item');
        thumbnails.forEach((thumb, index) => {
            thumb.classList.toggle('active', index === this.currentIndex);
        });
    }

    // Mostrar imagen anterior
    showPreviousImage() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.updateModalContent();
        }
    }

    // Mostrar imagen siguiente
    showNextImage() {
        if (this.currentIndex < this.currentImages.length - 1) {
            this.currentIndex++;
            this.updateModalContent();
        }
    }

    // Descargar imagen actual
    downloadCurrentImage() {
        const currentImage = this.currentImages[this.currentIndex];
        const link = document.createElement('a');
        link.href = currentImage.src;
        link.download = currentImage.filename || `imagen_${this.currentIndex + 1}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Alternar pantalla completa
    toggleFullscreen() {
        const modalContainer = this.modal.querySelector('.modal-container');
        
        if (!document.fullscreenElement) {
            modalContainer.requestFullscreen().catch(err => {
                console.log('Error al activar pantalla completa:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    // Mostrar información detallada de la imagen
    showImageInfo() {
        const currentImage = this.currentImages[this.currentIndex];
        const info = currentImage.metadata || {};
        
        let infoText = `Información de la imagen:\n\n`;
        infoText += `Título: ${currentImage.title || 'Sin título'}\n`;
        infoText += `Descripción: ${currentImage.description || 'Sin descripción'}\n`;
        
        if (info.timestamp) {
            infoText += `Tiempo del video: ${info.timestamp}\n`;
        }
        
        if (info.coordinates) {
            infoText += `Coordenadas: ${info.coordinates.lat}, ${info.coordinates.lon}\n`;
        }
        
        if (info.perspective) {
            infoText += `Perspectiva: ${info.perspective}\n`;
        }
        
        alert(infoText);
    }

    // Agregar estilos CSS para el modal
    addModalStyles() {
        if (document.getElementById('image-modal-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'image-modal-styles';
        styles.textContent = `
            .image-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: none;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .image-modal.visible {
                opacity: 1;
            }
            
            .modal-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                backdrop-filter: blur(5px);
            }
            
            .modal-container {
                position: relative;
                max-width: 95vw;
                max-height: 95vh;
                background: white;
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                transform: scale(0.9);
                transition: transform 0.3s ease;
            }
            
            .image-modal.visible .modal-container {
                transform: scale(1);
            }
            
            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 25px;
                border-bottom: 1px solid #e0e0e0;
                background: #f8f9fa;
                border-radius: 12px 12px 0 0;
            }
            
            .modal-title {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            
            .image-title {
                font-size: 1.2em;
                font-weight: 600;
                color: #2c3e50;
            }
            
            .image-counter {
                font-size: 0.9em;
                color: #6c757d;
            }
            
            .modal-close {
                background: none;
                border: none;
                font-size: 1.5em;
                cursor: pointer;
                padding: 5px 10px;
                border-radius: 50%;
                transition: background-color 0.2s ease;
                color: #6c757d;
            }
            
            .modal-close:hover {
                background: #e9ecef;
                color: #2c3e50;
            }
            
            .modal-body {
                flex: 1;
                display: flex;
                flex-direction: column;
                min-height: 0;
            }
            
            .image-navigation {
                flex: 1;
                display: flex;
                align-items: center;
                gap: 20px;
                padding: 20px;
                min-height: 0;
            }
            
            .nav-button {
                background: rgba(0, 0, 0, 0.7);
                color: white;
                border: none;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                font-size: 1.5em;
                cursor: pointer;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .nav-button:hover:not(:disabled) {
                background: rgba(0, 0, 0, 0.9);
                transform: scale(1.1);
            }
            
            .nav-button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none;
            }
            
            .image-container {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                min-height: 0;
                position: relative;
            }
            
            .modal-image {
                max-width: 100%;
                max-height: 70vh;
                object-fit: contain;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            }
            
            .image-info {
                margin-top: 15px;
                text-align: center;
                max-width: 100%;
            }
            
            .image-description {
                color: #6c757d;
                font-style: italic;
                line-height: 1.4;
            }
            
            .image-thumbnails {
                display: flex;
                gap: 10px;
                padding: 15px 20px;
                overflow-x: auto;
                border-top: 1px solid #e0e0e0;
                background: #f8f9fa;
            }
            
            .thumbnail-item {
                flex-shrink: 0;
                width: 80px;
                height: 60px;
                border-radius: 6px;
                overflow: hidden;
                cursor: pointer;
                border: 2px solid transparent;
                transition: all 0.2s ease;
                position: relative;
            }
            
            .thumbnail-item:hover {
                border-color: #3498db;
                transform: scale(1.05);
            }
            
            .thumbnail-item.active {
                border-color: #e74c3c;
                box-shadow: 0 0 10px rgba(231, 76, 60, 0.3);
            }
            
            .thumbnail-item img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            
            .thumbnail-label {
                position: absolute;
                bottom: 2px;
                left: 2px;
                right: 2px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                font-size: 0.7em;
                padding: 2px 4px;
                border-radius: 3px;
                text-align: center;
            }
            
            .modal-footer {
                padding: 15px 25px;
                border-top: 1px solid #e0e0e0;
                background: #f8f9fa;
                border-radius: 0 0 12px 12px;
            }
            
            .image-actions {
                display: flex;
                gap: 10px;
                justify-content: center;
            }
            
            .action-button {
                padding: 8px 16px;
                background: #3498db;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 0.9em;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 5px;
            }
            
            .action-button:hover {
                background: #2980b9;
                transform: translateY(-1px);
            }
            
            /* Responsive design */
            @media (max-width: 768px) {
                .modal-container {
                    max-width: 98vw;
                    max-height: 98vh;
                    margin: 1vh;
                }
                
                .modal-header {
                    padding: 15px 20px;
                }
                
                .image-navigation {
                    padding: 15px;
                    gap: 10px;
                }
                
                .nav-button {
                    width: 40px;
                    height: 40px;
                    font-size: 1.2em;
                }
                
                .modal-image {
                    max-height: 60vh;
                }
                
                .image-actions {
                    flex-wrap: wrap;
                    gap: 8px;
                }
                
                .action-button {
                    flex: 1;
                    min-width: 120px;
                    justify-content: center;
                }
                
                .thumbnail-item {
                    width: 60px;
                    height: 45px;
                }
            }
        `;
        
        document.head.appendChild(styles);
    }

    // Método estático para crear datos de imagen desde un elemento DOM
    static createImageDataFromElement(imgElement, additionalData = {}) {
        return {
            src: imgElement.src,
            alt: imgElement.alt || 'Imagen de análisis',
            title: additionalData.title || 'Vista de Fotograma',
            description: additionalData.description || '',
            shortTitle: additionalData.shortTitle || '',
            filename: additionalData.filename || 'imagen.jpg',
            metadata: additionalData.metadata || {}
        };
    }
}

// Crear instancia global del visor modal
window.imageModalViewer = new ImageModalViewer();