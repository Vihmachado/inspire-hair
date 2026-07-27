import { ImageSegmenter, FilesetResolver } from "@mediapipe/tasks-vision";

const videoElement = document.querySelector("#camVideo");
const canvasElement = document.querySelector("#outputCanvas");
const canvasCtx = canvasElement.getContext("2d");

let segmenter;
let corInspiracao = null; // Começa sem filtro no início.

// 1. Ligar a câmera
async function startVideoFromCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = stream;
        console.log("Câmera conectada!");
    } catch (error) {
        console.error("Erro na câmera:", error);
    }
}

// 2. Inicializar IA
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
    console.log("IA pronta!");
}

// 3. Loop de Renderização Inteligente
let lastVideoTime = -1;

function renderLoop() {
    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;

    if (videoElement.currentTime !== lastVideoTime) {
        lastVideoTime = videoElement.currentTime;
        const startTimeMs = performance.now();
        
        segmenter.segmentForVideo(videoElement, startTimeMs, (result) => {
            // Limpa o canvas sempre
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
            
            // REGRA: Se a usuária NÃO escolheu nenhuma inspiração ainda, não desenha nada!
            if (!corInspiracao) {
                return; 
            }

            // Se ela já escolheu a inspiração, aplicamos o filtro de cor suave
            if (result.categoryMask) {
                const mask = result.categoryMask.getAsUint8Array();
                const imageData = canvasCtx.createImageData(canvasElement.width, canvasElement.height);
                const pixels = imageData.data;
                
                // Mapeia o cabelo com a cor extraída da inspiração
                for (let i = 0; i < mask.length; i++) {
                    if (mask[i] === 1) {
                        pixels[i * 4] = corInspiracao.r;     
                        pixels[i * 4 + 1] = corInspiracao.g; 
                        pixels[i * 4 + 2] = corInspiracao.b; 
                        pixels[i * 4 + 3] = 130; // Transparência ideal para parecer tintura real
                    }
                }

                // Cria um canvas temporário para suavizar as bordas (evita o efeito recortado/marcado)
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvasElement.width;
                tempCanvas.height = canvasElement.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.putImageData(imageData, 0, 0);

                canvasCtx.save();
                canvasCtx.globalCompositeOperation = 'multiply'; // Mescla com o brilho e mechas reais do cabelo
                canvasCtx.filter = 'blur(5px)';   // Suaviza o contorno para não cortar a pele
                canvasCtx.drawImage(tempCanvas, 0, 0);
                canvasCtx.restore();
            }
        });
    }

    window.requestAnimationFrame(renderLoop);
}

async function startApp() {
    await startVideoFromCamera();
    await initMediaPipe();
    renderLoop(); 
}

startApp();

// Botão Limpar: Remove a cor e deixa o vídeo limpo de novo
document.querySelector('.btn-clear').addEventListener('click', () => {
    corInspiracao = null;
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    console.log('Filtro limpo - Câmera limpa');
});

// Leitura da Imagem de Inspiração: Extrai apenas a cor predominante da foto enviada
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