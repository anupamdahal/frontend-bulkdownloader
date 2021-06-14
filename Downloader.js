class Downloader{

  /**
   * 
   * @param {Array<string>} downloadLinks 
   */
  constructor(downloadLinks){
    //constants
    this.bufferSize = (2*1024*1024*1024)
    this.noOfActiveFetchLimit = 6
    this.fallbackNoOfActiveFetchLimit = 2
    this.downloadInterval = 1000
    this.fallbackDownloadInterval = 10000

    this.expectedBufferUsed = 0
    this.noOfActiveFetch = 0
    
    this.isDownloadOngoing = false
    this.iteratedOnce = false
    this.lastFiveIsEqual = false
    this.hasSizeInfo = true
    
    this.downloadLinks = downloadLinks || []
    this.queue = new DownloadQueue()
    this.lastFive = new LastFive()
    this.lastFiveOnloadedSize = new LastFive()
  }

  addExpectedBufferUsed(size){
    this.expectedBufferUsed = this.expectedBufferUsed + size
  }

  isFallBack(){

    return (
      this.expectedBufferUsed > this.bufferSize ||
      !this.hasSizeInfo &&
      (
        !this.lastFiveOnloadedSize.getAvgSize() ?
        true :
        this.lastFiveOnloadedSize.getAvgSize() > this.bufferSize
      ))


  }

  getNoOfActiveFetchLimit(){
    return !this.isFallBack() ?
      this.noOfActiveFetchLimit : this.fallbackNoOfActiveFetchLimit
  }

  getDownloadInterval(){
    return !this.isFallBack() ?
      this.downloadInterval : this.fallbackDownloadInterval
  }

  _queueHandler(){
    this.downloadLinks = this.downloadLinks.concat(this.queue.getURLs())
    this.queue.reset()
    this._initiateDownload()
  }

  _download(downloadLink){
    const xhr = new XMLHttpRequest()
    
    xhr.onload = res => {
      this.lastFiveOnloadedSize.push(res.loaded)
  
      const blobURL = window.URL.createObjectURL(xhr.response)
      const a = document.createElement('a')  
      const fileName = downloadLink.substr(downloadLink.lastIndexOf('/') + 1)
      
      a.href = blobURL
      a.setAttribute('download', fileName)  
      
      document.body.appendChild(a)  
      a.click()
      
      a.remove()  
      window.URL.revokeObjectURL(blobURL)
  
      //deduct the memory freed here
      if (this.expectedBufferUsed !== 0){
        this.expectedBufferUsed -= res.loaded
      }

      this.noOfActiveFetch -= 1
    }

    xhr.onreadystatechange = res => {
      
      if(xhr.readyState === 1){
        this.noOfActiveFetch += 1
        return
      }
  
      if(xhr.readyState !== 2) return
  
      const size = xhr.getResponseHeader("Content-length") ?
        parseInt(xhr.getResponseHeader("Content-length")) :
        null
  
      this.hasSizeInfo = size ? true : false
      
      this.lastFive.push(size)
      this.lastFiveIsEqual = this.lastFive.allEqual()

      if(
        this.bufferSize - this.expectedBufferUsed <= size &&
        !this.iteratedOnce &&
        !this.lastFiveIsEqual &&
        !this.lastFiveOnloadedSize.allEqual()
      ){
        //if lastFive elements have same size
        //we assume that all the requests will be the same
        //until proven differently
  
        xhr.abort()
        this.queue.push({
          url: downloadLink,
          size
        })
  
        this.lastFive.push(size)
  
        //try to squeeze in another request that fits the buffer
        if(this.noOfActiveFetch < this.getNoOfActiveFetchLimit()){
          const fetchSize = this.bufferSize - this.expectedBufferUsed
          const newRequestItem = this.queue.pop(fetchSize)
          
          if(newRequestItem != undefined){
            this._download(newRequestItem.url)
            return
          }
        }
  
        this.noOfActiveFetch -= 1
        return
      }
  
      if(this.hasSizeInfo){
        this.addExpectedBufferUsed(size)
        return
      }
  
      if(this.lastFiveOnloadedSize.allEqual()){
        this.addExpectedBufferUsed(this.lastFiveOnloadedSize.array[4])
      }else if(this.lastFiveOnloadedSize.getAvgSize()){
        this.addExpectedBufferUsed(this.lastFiveOnloadedSize.getAvgSize())
      }else{
        this.addExpectedBufferUsed(0)
      }
    }
    
    xhr.open('GET', downloadLink)
    xhr.responseType = 'blob'
    xhr.send(null)
  }

  _initiateDownload(){
    
    const setDownloadInterval = () => {
      if (this.downloadLinks.length == 0){
        this.iteratedOnce = true
        if (this.queue.length == 0){
          this.isDownloadOngoing = false
          return
        }
        this._queueHandler()
        return
      }

      if(this.noOfActiveFetch >= this.getNoOfActiveFetchLimit()){
        setTimeout(setDownloadInterval,
          this.getDownloadInterval() + this.fallbackDownloadInterval)
        return
      }
  
      this._download(`${fileServerBaseUrl}/${directoryEndpoint}/${this.downloadLinks.pop()}`)
      setTimeout(setDownloadInterval, this.getDownloadInterval())
    }
    setTimeout(setDownloadInterval, 0)
  }

  /**
   * 
   * @param {Array.<string>} downloadLinks 
   */
  download(downloadLinks){
    this.downloadLinks = this.downloadLinks.concat(downloadLinks)
    
    if(!this.isDownloadOngoing){
      this.isDownloadOngoing = true
      this._initiateDownload()
      return
    }

    return
  }

  reset(){
    this.expectedBufferUsed = 0
    this.noOfActiveFetch = 0
    
    this.isDownloadOngoing = false
    this.iteratedOnce = false
    this.lastFiveIsEqual = false
    
    this.downloadLinks = []
    this.queue.reset()
    this.lastFive.reset()
  }

}