class Downloader{
  "use strict"

  /**
   * 
   * @param {Array<string>} downloadLinks 
   */
  constructor(downloadLinks){
    //downloadConstants
    this.bufferSize =
      downloadConstants.bufferSize
    this.noOfActiveFetchLimit =
      downloadConstants.noOfActiveFetchLimit
    this.fallbackNoOfActiveFetchLimit =
      downloadConstants.fallbackNoOfActiveFetchLimit
    this.downloadInterval =
      downloadConstants.downloadInterval
    this.fallbackDownloadInterval =
      downloadConstants.fallbackDownloadInterval

    this.expectedBufferUsed = 0
    this.activeFetchCount = 0
    this.downloadedCount = 0
    this.failedCount = 0
    this.downloadJobCount =
      downloadLinks?.length ? downloadLinks.length : 0

    this.isDownloadOngoing = false
    this.iteratedOnce = false
    this.lastFiveIsEqual = false
    this.hasSizeInfo = true
    
    this.downloadLinks = downloadLinks ?? []
    this.failedDownloads = {
      networkError : [], //with status 0
      httpError: []  //status >= 400
    }
    this.queue = new DownloadQueue()
    this.lastFive = new LastFive()
    this.lastFiveOnloadedSize = new LastFive()
  }

  _isFallBack(){
    return (
    this.expectedBufferUsed > this.bufferSize ||
    !this.hasSizeInfo &&
    (
      !this.lastFiveOnloadedSize.getAvgSize() ?
      true :
      this.lastFiveOnloadedSize.getAvgSize() > this.bufferSize
    ))
  }

  _isDownloadComplete(){
    return (this.downloadedCount + this.failedCount
      === this.downloadJobCount)
  }

  _shouldAbort(size){
    return (this.bufferSize - this.expectedBufferUsed <= size &&
    !this.iteratedOnce &&
    !this.lastFiveIsEqual &&
    !this.lastFiveOnloadedSize.allEqual())
  }

  _getNoOfActiveFetchLimit(){
    return !this._isFallBack() ?
      this.noOfActiveFetchLimit : this.fallbackNoOfActiveFetchLimit
  }

  _getDownloadInterval(){
    return !this._isFallBack() ?
      this.downloadInterval : this.fallbackDownloadInterval
  }

  _addExpectedBufferUsed(size){

    if (!size){
      if(this.lastFiveOnloadedSize.allEqual()){
        size = this.lastFiveOnloadedSize.array[4]
      }else if(this.lastFiveOnloadedSize.getAvgSize()){
       size = this.lastFiveOnloadedSize.getAvgSize()
      }else{
        size = 0
      }
    }

    this.expectedBufferUsed += size

    //for cases when size info isn't available
    if(this.expectedBufferUsed < 0){
      this.expectedBufferUsed = 0
    }
  }

  _abortHandler(xhr, downloadLink, size){
     //if lastFive elements have same size
      //we assume that all the requests will be the same
      //until proven differently
      xhr.abortedByUser = true
      xhr.abort()
      this.queue.push({
        size: size,
        //this line needs to change for the final product
        url: downloadLink.substr(downloadLink.lastIndexOf('/') + 1)
      })
      this.lastFive.push(size)      
      this.activeFetchCount--
      return
  }

  _requestSmallerFile(){
    if(this.activeFetchCount >= this._getNoOfActiveFetchLimit()){
      return false
    }

    const fetchSize = this.bufferSize - this.expectedBufferUsed
    const newRequestItem = this.queue.pop(fetchSize)
    
    if(newRequestItem != undefined){
      this._fetch(newRequestItem.url)
      return true
    }

    return false
  }

  _filterRequests(xhr, downloadLink){
    const size = xhr.getResponseHeader("Content-length") ?
      parseInt(xhr.getResponseHeader("Content-length")) :
      null

    this.hasSizeInfo = size ? true : false
    
    this.lastFive.push(size)
    this.lastFiveIsEqual = this.lastFive.allEqual()

    if(this._shouldAbort(size)){
      this._abortHandler(xhr, downloadLink, size)
      this._requestSmallerFile()
      return
    }

    this._addExpectedBufferUsed(size)
  }

  _saveToDisk(blob, name){
  
    const blobURL = window.URL.createObjectURL(blob)
    const a = document.createElement('a')  
    const fileName = name.substr(name.lastIndexOf('/') + 1)
    
    a.href = blobURL
    a.setAttribute('download', fileName)  
    
    document.body.appendChild(a)  
    a.click()
    
    a.remove()  
    window.URL.revokeObjectURL(blobURL)
  }

  _updateDownloadParams(loaded, success=true){
    this.lastFiveOnloadedSize.push(loaded)
    this._addExpectedBufferUsed((-1)*loaded)

    this.activeFetchCount--

    if(success)
      this.downloadedCount++
  }

  _errorHandler(xhr, downloadLink){
    this.failedCount++
    
    const status = xhr.status
    if(status === 0){
      if (xhr.abortedByUser === true){
        return
      }
      this.failedDownloads.networkError.push(downloadLink)
    } else{
      this.failedDownloads.httpError.push({
        status,
        url: downloadLink
      })
    }
  }

  _logErrors(){

    if(this.failedDownloads.httpError.length === 0 &&
      this.failedDownloads.networkError.length === 0
    ){
      return
    }

    const log = []
    log.push(`${"ERROR TYPE".padEnd(20)}${"ERROR CODE".padEnd(20)}URL\n\n`)
    
    for(const i of this.failedDownloads.networkError){
      log.push(`${"NETWORK ERROR".padEnd(20)}${"UNKNOWN".padEnd(20)}${i}\n`)
    }
    
    for (const i of this.failedDownloads.httpError){
      log.push(`${"HTTP(S) ERROR".padEnd(20)}${i.status.toString().padEnd(20)}${i.url}\n`)
    }

    if (log.length >= 3){
      const lastLine = log.pop()
      log.push(lastLine.slice(0, -1))
    }

    this._saveToDisk((new Blob(log)), "errorlog.txt")
  
  }

  _onload(xhr, res, downloadLink){
    const status = xhr.status
    
    if(status >= 200 && status < 400){
      this._updateDownloadParams(res.loaded)
      this._saveToDisk(xhr.response, downloadLink)
    } else {
      this._updateDownloadParams(0, false)
      this._errorHandler(xhr, downloadLink)
    }

    if(this._isDownloadComplete()){
      console.log("download is complete...")
      this._logErrors()
      this._reset()
    }
  }

  _fetch(downloadLink){
    const xhr = new XMLHttpRequest()
    xhr.overrideMimeType('application/octet-stream')

    xhr.onreadystatechange = res => {

      const readyState = xhr.readyState
      
      if (readyState === 1){
        this.fetchCount++
        this.activeFetchCount++
      } else if (readyState === 2){
        this._filterRequests(xhr, downloadLink)
      } else if (readyState === 3){
        return
      } else if (readyState === 4){
        this._onload(xhr, res, downloadLink)
      } else {
        console.error("Unknown readyState...")
        return
      }
  
    }
    
    xhr.onerror = this.onerror
    xhr.open('GET', downloadLink)
    xhr.responseType = 'blob'
    xhr.send(null)
  }

  _initiateSecondDownloadIteration(){
    this.iteratedOnce = true  
    if (this.queue.length == 0){
      return
    }
    this.downloadLinks = this.downloadLinks.concat(this.queue.getURLs())
    this.queue.reset()
    this._initiateDownload()
    if(this.downloadLinks.length !== 0){
      this._initiateDownload()
    }
    return
  }

  _initiateDownload(){
    
    const setDownloadInterval = () => {
      if (this.downloadLinks.length === 0){
        this._initiateSecondDownloadIteration()
        return
      }

      if(this.activeFetchCount >= this._getNoOfActiveFetchLimit()){
        setTimeout(setDownloadInterval,
          this._getDownloadInterval() + this.fallbackDownloadInterval)
        return
      }
      //this line needs to change for the final product
      this._fetch(`${fileServerBaseUrl}/${directoryEndpoint}/${this.downloadLinks.pop()}`)
      setTimeout(setDownloadInterval, this._getDownloadInterval())
    }
    setTimeout(setDownloadInterval, 0)
  }

  /**
   * 
   * @param {Array.<string>} downloadLinks 
   */
  download(downloadLinks){
    if(downloadLinks != undefined){
      this.downloadLinks = this.downloadLinks.concat(downloadLinks)
      this.downloadJobCount +=
        this.downloadLinks?.length ? downloadLinks.length : 0
    }
    
    if(!this.isDownloadOngoing){
      this.isDownloadOngoing = true
      this._initiateDownload()
      return
    }

    return
  }

  _reset(){
    this.expectedBufferUsed = 0
    this.activeFetchCount = 0

    this.downloadedCount = 0
    this.failedCount = 0
    this.downloadJobCount = 0
    
    this.isDownloadOngoing = false
    this.iteratedOnce = false
    this.lastFiveIsEqual = false
    this.hasSizeInfo = true
    
    this.downloadLinks = []
    this.failedDownloads = {
      networkError : [],
      httpError: []
    }
    // this.queue.reset()
    this.lastFive.reset()
    this.lastFiveOnloadedSize.reset()
  }

}