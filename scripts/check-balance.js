const hre = require("hardhat");

async function main() {
  console.log("==========================================");
  console.log(" CHECKING DIDLAB WALLET BALANCE");
  console.log("==========================================\n");

  try {
    // Get signer
    const [deployer] = await hre.ethers.getSigners();
    
    // Get address - different syntax for ethers v6
    const address = await deployer.getAddress();
    
    // Get balance
    const balance = await hre.ethers.provider.getBalance(address);
    
    // Format balance - ethers v6 uses formatEther directly
    const balanceInTT = hre.ethers.formatEther(balance);

    console.log("Network:", hre.network.name);
    console.log("Chain ID:", hre.network.config.chainId);
    console.log("Address:", address);
    console.log("Balance:", balanceInTT, "TT");

    if (balance === 0n) {
      console.log("\n WARNING: Balance is 0!");
      console.log("💡 Get test tokens from: https://faucet.didlab.org");
      console.log("\nSteps:");
      console.log("1. Visit https://faucet.didlab.org");
      console.log("2. Enter your address:", address);
      console.log("3. Request test TT tokens");
      console.log("4. Wait ~30 seconds for confirmation");
    } else {
      console.log("\n You have sufficient balance to deploy");
      console.log("\nNext steps:");
      console.log("1. Compile contracts: npm run compile");
      console.log("2. Deploy to DIDLab: npm run deploy:didlab");
    }

    console.log("\n==========================================");
  } catch (error) {
    console.error("\n Error checking balance:");
    console.error(error.message);
    
    if (error.message.includes("invalid private key")) {
      console.log("\n Fix: Check your .env file");
      console.log("   - PRIVATE_KEY should not have 0x prefix");
      console.log("   - PRIVATE_KEY should not have quotes");
      console.log("   - PRIVATE_KEY should be 64 characters (hex)");
    }
    
    if (error.message.includes("could not detect network")) {
      console.log("\n Fix: Check network connection");
      console.log("   - Make sure you can access: https://eth.didlab.org");
      console.log("   - Try again in a moment");
    }
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });