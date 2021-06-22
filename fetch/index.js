window.onload = () => {
  
  console.log("Html Ready!")

  const downloadButton = document.getElementById(downloadButtonId)
  const downloader = new Downloader()

  downloadButton.onclick = () => {

    return fetch(`${fileServerBaseUrl}/${urlListFilename}`)
      .then(res => res.json())
      .then(({ urls }) => downloader.download(urls))
      .catch(err => console.error(err))
  }

}