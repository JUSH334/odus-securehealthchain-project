const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const address = await deployer.getAddress();
  
  const confirmedNonce = await hre.ethers.provider.getTransactionCount(address, "latest");
  
  console.log("Sending cancel transaction with nonce:", confirmedNonce);
  console.log("This will replace any stuck transaction at this nonce\n");
  
  // Send a 0-value transaction to yourself with higher gas
  const tx = await deployer.sendTransaction({
    to: address,
    value: 0,
    nonce: confirmedNonce,
    gasPrice: hre.ethers.parseUnits("2", "gwei"), // Higher gas to replace stuck tx
    gasLimit: 21000
  });
  
  console.log("Cancel transaction sent:", tx.hash);
  console.log("View at: https://explorer.didlab.org/tx/" + tx.hash);
  console.log("\nWaiting for confirmation...");
  
  await tx.wait();
  
  console.log("Done! Nonce cleared. Try deploying again.");
}

main();