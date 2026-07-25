function startVideoFromCamera(){

    navigator.mediaDevices.getUserMedia({video:true}).then(stream=>{

        const videoElement = document.querySelector("#camVideo")
        videoElement.srcObject = stream
}).catch(error=>{console.log(error)})

}

window.addEventListener("DOMContentLoaded", startVideoFromCamera)

  document.querySelector('.btn-clear').addEventListener('click', () => {
    console.log('Limpar');
  });