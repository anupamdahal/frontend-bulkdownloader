class DownloadQueue{
  constructor(){
    this.queue = []
  }

  length(){
    return this.queue.length
  }

  /**
   * return equal or less than equal
   * @param {number} size 
   * @returns {{size: number, url: string}}
   */

  pop(size){
    if(this.queue.length === 0){
      return null
    }

    if (size == undefined){
      return this.queue.pop()
    }

    let left = 0;
    let right = this.queue.length - 1;
    let count = null;

    while (left < right) {
      let mid = parseInt((right + left) / 2, 10);

      if (this.queue[mid].size < size) {
        count = mid + 1;
        left = mid + 1;
      }else if (this.queue[mid].size === size) {
        count = mid
        break
      }
      else {
        right = mid - 1;
        count = null
      }
    }

    if(count !== null){
      const value = this.queue[count]
      this.queue.splice(count, 1)
      return value
    }
    
    return count
      
  }

  /**
   * @param {{size: number, url: string}} item
   */
  push(item){
    let low = 0,
        high = this.queue.length

    while (low < high) {
      let mid = (low + high) >>> 1
      if (this.queue[mid].size < item.size) low = mid + 1
      else high = mid
    }
    this.queue.splice(low, 0, item)
  }

  getURLs(){
    return  this.queue.map(item => item.url)
  }

  reset(){
    this.queue = []
  }
}