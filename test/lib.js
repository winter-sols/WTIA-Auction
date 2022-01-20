module.exports.advanceTime = async (seconds) => {
  hre.network.provider.request({
    method: "evm_increaseTime",
    params: [seconds]
  })
  hre.network.provider.request({
    method: "evm_mine",
    params: []
  })
}
