// 1. Importações
import { ImageSegmenter, FilesetResolver } from "@mediapipe/tasks-vision";

// Variáveis Globais do Projeto
let segmenter;
let corInspiracao = null; // Começa sem filtro
let lastVideoTime = -1;

const videoElement = document.querySelector("#camVideo");
const canvasElement = document.querySelector("#outputCanvas");
const canvasCtx = canvasElement.getContext("2d");

// 2. Ligar a Câmera
async function startVideoFromCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = stream;
        
        // Aguarda o vídeo carregar as dimensões reais para ajustar o canvas
        return new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                resolve();
            };
        });
    } catch (error) {
        console.error("Erro na câmera:", error);
    }
}

// 3. Inicializar a IA do MediaPipe
async function initMediaPipe() {
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    
    segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/latest/hair_segmenter.tflite",
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        outputCategoryMask: true,
    });
    console.log("IA do Inspire Hair pronta!");
}

// 4. Loop de Renderização Inteligente e Realista
function renderLoop() {
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;

    if (videoElement.currentTime !== lastVideoTime) {
        lastVideoTime = videoElement.currentTime;
        const startTimeMs = performance.now();
        
        segmenter.segmentForVideo(videoElement, startTimeMs, (result) => {
            
            // Se a usuária NÃO escolheu cor, limpamos o canvas (deixa transparente).
            if (!corInspiracao || !result.categoryMask) {
                canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
                return; 
            }

            // 1. Se ela escolheu a cor, desenhamos o vídeo original no canvas primeiro.
            canvasCtx.save();
            canvasCtx.globalCompositeOperation = 'source-over';
            canvasCtx.globalAlpha = 1.0;
            canvasCtx.filter = 'none';
            canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
            canvasCtx.restore();

            // 2. Extração da máscara de cabelo
            const mask = result.categoryMask.getAsUint8Array();
            
            // Criamos um canvas invisível apenas para gerar a "tinta"
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = canvasElement.width;
            maskCanvas.height = canvasElement.height;
            const maskCtx = maskCanvas.getContext('2d');
            
            const imageData = maskCtx.createImageData(maskCanvas.width, maskCanvas.height);
            const pixels = imageData.data;
            
            // Pintamos a cor desejada apenas onde o MediaPipe identificou cabelo
            for (let i = 0; i < mask.length; i++) {
                if (mask[i] === 1) { // 1 = Área do Cabelo
                    pixels[i * 4] = corInspiracao.r;     
                    pixels[i * 4 + 1] = corInspiracao.g; 
                    pixels[i * 4 + 2] = corInspiracao.b; 
                    pixels[i * 4 + 3] = 255; // Opacidade total nesta etapa
                } else {
                    pixels[i * 4 + 3] = 0; // Transparente onde não é cabelo
                }
            }
            maskCtx.putImageData(imageData, 0, 0);

            // 3. Aplicação Realista no Canvas Principal
            canvasCtx.save();
            
            // 'color' muda a cor, mas mantém a textura, os brilhos e as sombras originais
            canvasCtx.globalCompositeOperation = 'color';
            canvasCtx.filter = 'blur(6px)'; 
            canvasCtx.globalAlpha = 0.80; 
            canvasCtx.drawImage(maskCanvas, 0, 0);
            
            // Camada 'overlay' para devolver um pouco de profundidade e brilho extra
            canvasCtx.globalCompositeOperation = 'overlay';
            canvasCtx.globalAlpha = 0.15;
            canvasCtx.drawImage(maskCanvas, 0, 0);
            
            canvasCtx.restore();
        });
    }

    window.requestAnimationFrame(renderLoop);
}

// 5. Inicialização Geral do Aplicativo
async function startApp() {
    await startVideoFromCamera();
    await initMediaPipe();
    renderLoop(); 
}

window.addEventListener("DOMContentLoaded", startApp);

// 6. Botão Limpar: Remove a cor e limpa o canvas
document.querySelector('.btn-clear').addEventListener('click', () => {
    corInspiracao = null;
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    console.log('Filtro limpo - Câmera limpa');
});

// 7. Leitura da Imagem de Inspiração: Extrai a cor predominante
document.querySelector('#img-insp').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvasTemp = document.createElement('canvas');
                const ctxTemp = canvasTemp.getContext('2d');
                canvasTemp.width = img.width;
                canvasTemp.height = img.height;
                ctxTemp.drawImage(img, 0, 0);

                // Pega a cor exata do centro da foto de inspiração escolhida
                const pixelData = ctxTemp.getImageData(img.width / 2, img.height / 2, 1, 1).data;
                
                corInspiracao = {
                    r: pixelData[0],
                    g: pixelData[1],
                    b: pixelData[2]
                };

                console.log("Nova cor de tintura aplicada:", corInspiracao);
            }
            img.src = e.target.result;
        }
        reader.readAsDataURL(file);
    }
});