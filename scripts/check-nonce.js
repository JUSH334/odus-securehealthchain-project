const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const address = await deployer.getAddress();
  
  console.log("Checking nonce for:", address);
  
  // Get nonce from network (includes pending)
  const pendingNonce = await hre.ethers.provider.getTransactionCount(address, "pending");
  
  // Get nonce from latest block (confirmed only)
  const confirmedNonce = await hre.ethers.provider.getTransactionCount(address, "latest");
  
  console.log("Confirmed nonce:", confirmedNonce);
  console.log("Pending nonce:", pendingNonce);
  
  if (pendingNonce > confirmedNonce) {
    console.log("\nWARNING: You have", (pendingNonce - confirmedNonce), "pending transaction(s)");
    console.log("This will block new transactions until they confirm or are replaced");
  } else {
    console.log("\nOK: No pending transactions blocking");
  }
}

main();