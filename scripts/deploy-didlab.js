const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("========================================");
  console.log("DEPLOYING TO DIDLAB BLOCKCHAIN");
  console.log("========================================\n");

  try {
    // Get deployer
    console.log("Connecting to network...");
    const [deployer] = await hre.ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    
    console.log("Checking balance...");
    const balance = await hre.ethers.provider.getBalance(deployerAddress);
    
    console.log("\nConnected!");
    console.log("Network:", hre.network.name);
    console.log("Chain ID:", hre.network.config.chainId);
    console.log("Deployer:", deployerAddress);
    console.log("Balance:", hre.ethers.formatEther(balance), "TT");
    
    // Check network is responsive
    console.log("\nTesting network connection...");
    const blockNumber = await hre.ethers.provider.getBlockNumber();
    console.log("Network responsive! Current block:", blockNumber);

    if (balance === 0n) {
      console.error("\nERROR: Zero balance!");
      process.exit(1);
    }

    // Deploy PatientRegistry
    console.log("\nDeploying PatientRegistry...");
    console.log("   Getting contract factory...");
    const PatientRegistry = await hre.ethers.getContractFactory("PatientRegistry");
    
    console.log("   Sending deployment transaction...");
    const patientRegistry = await PatientRegistry.deploy();
    
    const deployTx1 = patientRegistry.deploymentTransaction();
    console.log("   Transaction sent!");
    console.log("   Tx Hash:", deployTx1.hash);
    console.log("   Check: https://explorer.didlab.org/tx/" + deployTx1.hash);
    
    console.log("   Waiting for confirmation...");
    await patientRegistry.waitForDeployment();
    
    const patientRegistryAddress = await patientRegistry.getAddress();
    console.log("   PatientRegistry deployed!");
    console.log("   Address:", patientRegistryAddress);

    // Small delay
    console.log("\nWaiting 5 seconds...");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Deploy Payment
    console.log("\nDeploying Payment...");
    console.log("   Getting contract factory...");
    const Payment = await hre.ethers.getContractFactory("Payment");
    
    console.log("   Sending deployment transaction...");
    const payment = await Payment.deploy();
    
    const deployTx2 = payment.deploymentTransaction();
    console.log("   Transaction sent!");
    console.log("   Tx Hash:", deployTx2.hash);
    console.log("   Check: https://explorer.didlab.org/tx/" + deployTx2.hash);
    
    console.log("   Waiting for confirmation...");
    await payment.waitForDeployment();
    
    const paymentAddress = await payment.getAddress();
    console.log("   Payment deployed!");
    console.log("   Address:", paymentAddress);

    // Test transactions
    console.log("\nTesting PatientRegistry...");
    const testMemberID = "MEM" + Date.now().toString().slice(-6) + "TEST";
    const testData = "0x" + Buffer.from(JSON.stringify({
      test: true,
      timestamp: new Date().toISOString()
    })).toString('hex');
    
    const registerTx = await patientRegistry.registerPatient(testMemberID, testData);
    console.log("   Tx:", registerTx.hash);
    await registerTx.wait();
    console.log("   Confirmed!");

    console.log("\nTesting Payment...");
    const testPaymentId = "PAY" + Date.now().toString().slice(-6) + "TEST";
    const paymentTx = await payment.processPayment(
      testPaymentId, "ITEM001", "bill", testMemberID,
      { value: hre.ethers.parseEther("0.001") }
    );
    console.log("   Tx:", paymentTx.hash);
    await paymentTx.wait();
    console.log("   Confirmed!");

    // Save deployment info
    const deploymentInfo = {
      network: "didlab",
      chainId: 252501,
      deployer: deployerAddress,
      deploymentTime: new Date().toISOString(),
      contracts: {
        PatientRegistry: {
          address: patientRegistryAddress,
          transactionHash: deployTx1.hash
        },
        Payment: {
          address: paymentAddress,
          transactionHash: deployTx2.hash
        }
      }
    };

    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(deploymentsDir, "didlab-deployment.json");
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    console.log("\n========================================");
    console.log("DEPLOYMENT COMPLETE!");
    console.log("========================================");
    console.log("\nSaved to:", deploymentFile);
    console.log("\nContract Addresses:");
    console.log("   PatientRegistry:", patientRegistryAddress);
    console.log("   Payment:", paymentAddress);
    console.log("\nView on Explorer:");
    console.log("   https://explorer.didlab.org/address/" + patientRegistryAddress);
    console.log("   https://explorer.didlab.org/address/" + paymentAddress);
    console.log("\n========================================\n");

  } catch (error) {
    console.error("\nFAILED:", error.message);
    console.error("\nFull error:");
    console.error(error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });