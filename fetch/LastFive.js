class LastFive{
  constructor(){
    this.array = new Array(5).fill(null)
  }

  allEqual(){
    return this.array.every(size => {
      return size ?
        size == this.array[0] : false
    })
  }

  push(item){
    this.array.shift()
    this.array.push(item)
  }

  getAvgSize(){
    let sum = 0, itr = 0
    this.array.forEach(size => {
      if(size){
        sum += size
        itr++
      }
    })

    return (itr && sum) ?
      (sum/itr) : null
  }

  reset(){
    this.array = new Array(5).fill(null)
  }
}