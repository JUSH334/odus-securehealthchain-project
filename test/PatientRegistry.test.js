const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PatientRegistry Contract", function () {
  let patientRegistry;
  let owner;
  let patient1;
  let patient2;
  let provider;

  beforeEach(async function () {
    // Get signers
    [owner, patient1, patient2, provider] = await ethers.getSigners();

    // Deploy contract
    const PatientRegistry = await ethers.getContractFactory("PatientRegistry");
    patientRegistry = await PatientRegistry.deploy();
    await patientRegistry.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await patientRegistry.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero total patients", async function () {
      expect(await patientRegistry.totalPatientsRegistered()).to.equal(0);
    });
  });

  describe("Patient Registration", function () {
    it("Should register a new patient successfully", async function () {
      const memberID = "MEM123456";
      const encryptedData = "0x" + Buffer.from("encrypted patient data").toString("hex");

      const tx = await patientRegistry.connect(patient1).registerPatient(memberID, encryptedData);
      await tx.wait();

      expect(await patientRegistry.totalPatientsRegistered()).to.equal(1);
      expect(await patientRegistry.isMemberIDRegistered(memberID)).to.equal(true);
    });

    it("Should emit PatientRegistered event", async function () {
      const memberID = "MEM123456";
      const encryptedData = "0x" + Buffer.from("encrypted patient data").toString("hex");

      await expect(patientRegistry.connect(patient1).registerPatient(memberID, encryptedData))
        .to.emit(patientRegistry, "PatientRegistered")
        .withArgs(patient1.address, memberID, await ethers.provider.getBlock("latest").then(b => b.timestamp + 1));
    });

    it("Should fail if member ID is empty", async function () {
      const encryptedData = "0x" + Buffer.from("encrypted patient data").toString("hex");

      await expect(
        patientRegistry.connect(patient1).registerPatient("", encryptedData)
      ).to.be.revertedWith("Member ID cannot be empty");
    });

    it("Should fail if encrypted data is empty", async function () {
      const memberID = "MEM123456";

      await expect(
        patientRegistry.connect(patient1).registerPatient(memberID, "")
      ).to.be.revertedWith("Encrypted data cannot be empty");
    });

    it("Should fail if patient already registered", async function () {
      const memberID = "MEM123456";
      const encryptedData = "0x" + Buffer.from("encrypted patient data").toString("hex");

      await patientRegistry.connect(patient1).registerPatient(memberID, encryptedData);

      await expect(
        patientRegistry.connect(patient1).registerPatient("MEM789", encryptedData)
      ).to.be.revertedWith("Patient already registered");
    });

    it("Should fail if member ID already registered", async function () {
      const memberID = "MEM123456";
      const encryptedData1 = "0x" + Buffer.from("encrypted patient data 1").toString("hex");
      const encryptedData2 = "0x" + Buffer.from("encrypted patient data 2").toString("hex");

      await patientRegistry.connect(patient1).registerPatient(memberID, encryptedData1);

      await expect(
        patientRegistry.connect(patient2).registerPatient(memberID, encryptedData2)
      ).to.be.revertedWith("Member ID already registered");
    });

    it("Should store patient data correctly", async function () {
      const memberID = "MEM123456";
      const encryptedData = "0x" + Buffer.from("encrypted patient data").toString("hex");

      await patientRegistry.connect(patient1).registerPatient(memberID, encryptedData);

      const patient = await patientRegistry.getPatient(patient1.address);
      expect(patient.memberID).to.equal(memberID);
      expect(patient.isActive).to.equal(true);
      expect(patient.assignedProvider).to.equal(ethers.ZeroAddress);
    });

    it("Should map member ID to address correctly", async function () {
      const memberID = "MEM123456";
      const encryptedData = "0x" + Buffer.from("encrypted patient data").toString("hex");

      await patientRegistry.connect(patient1).registerPatient(memberID, encryptedData);

      expect(await patientRegistry.getPatientAddressByMemberID(memberID)).to.equal(patient1.address);
    });
  });

  describe("Update Patient Data", function () {
    beforeEach(async function () {
      const memberID = "MEM123456";
      const encryptedData = "0x" + Buffer.from("encrypted patient data").toString("hex");
      await patientRegistry.connect(patient1).registerPatient(memberID, encryptedData);
    });

    it("Should update patient data successfully", async function () {
      const newEncryptedData = "0x" + Buffer.from("new encrypted patient data").toString("hex");

      const tx = await patientRegistry.connect(patient1).updatePatientData(newEncryptedData);
      await tx.wait();

      const patientData = await patientRegistry.connect(patient1).getPatientData(patient1.address);
      expect(patientData).to.equal(newEncryptedData);
    });

    it("Should emit PatientUpdated event", async function () {
      const newEncryptedData = "0x" + Buffer.from("new encrypted patient data").toString("hex");
      const memberID = "MEM123456";

      await expect(patientRegistry.connect(patient1).updatePatientData(newEncryptedData))
        .to.emit(patientRegistry, "PatientUpdated")
        .withArgs(patient1.address, memberID, await ethers.provider.getBlock("latest").then(b => b.timestamp + 1));
    });

    it("Should fail if patient not registered", async function () {
      const newEncryptedData = "0x" + Buffer.from("new encrypted patient data").toString("hex");

      await expect(
        patientRegistry.connect(patient2).updatePatientData(newEncryptedData)
      ).to.be.revertedWith("Patient not registered");
    });

    it("Should fail if encrypted data is empty", async function () {
      await expect(
        patientRegistry.connect(patient1).updatePatientData("")
      ).to.be.revertedWith("Encrypted data cannot be empty");
    });
  });

  describe("Assign Provider", function () {
    beforeEach(async function () {
      const memberID = "MEM123456";
      const encryptedData = "0x" + Buffer.from("encrypted patient data").toString("hex");
      await patientRegistry.connect(patient1).registerPatient(memberID, encryptedData);
    });

    it("Should assign provider successfully", async function () {
      await patientRegistry.connect(owner).assignProvider(patient1.address, provider.address);

      const patient = await patientRegistry.getPatient(patient1.address);
      expect(patient.assignedProvider).to.equal(provider.address);
    });

    it("Should emit ProviderAssigned event", async function () {
      await expect(patientRegistry.connect(owner).assignProvider(patient1.address, provider.address))
        .to.emit(patientRegistry, "ProviderAssigned")
        .withArgs(patient1.address, provider.address, await ethers.provider.getBlock("latest").then(b => b.timestamp + 1));
    });

    it("Should fail if not called by owner", async function () {
      await expect(
        patientRegistry.connect(patient1).assignProvider(patient1.address, provider.address)
      ).to.be.revertedWith("Only owner can call this function");
    });

    it("Should fail if patient not registered", async function () {
      await expect(
        patientRegistry.connect(owner).assignProvider(patient2.address, provider.address)
      ).to.be.revertedWith("Patient not registered");
    });

    it("Should fail if provider address is zero", async function () {
      await expect(
        patientRegistry.connect(owner).assignProvider(patient1.address, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid provider address");
    });
  });

  describe("Deactivate Patient", function () {
    beforeEach(async function () {
      const memberID = "MEM123456";
      const encryptedData = "0x" + Buffer.from("encrypted patient data").toString("hex");
      await patientRegistry.connect(patient1).registerPatient(memberID, encryptedData);
    });

    it("Should deactivate patient successfully", async function () {
      await patientRegistry.connect(owner).deactivatePatient(patient1.address);

      const patient = await patientRegistry.getPatient(patient1.address);
      expect(patient.isActive).to.equal(false);
    });

    it("Should emit PatientDeactivated event", async function () {
      const memberID = "MEM123456";

      await expect(patientRegistry.connect(owner).deactivatePatient(patient1.address))
        .to.emit(patientRegistry, "PatientDeactivated")
        .withArgs(patient1.address, memberID, await ethers.provider.getBlock("latest").then(b => b.timestamp + 1));
    });

    it("Should fail if not called by owner", async function () {
      await expect(
        patientRegistry.connect(patient1).deactivatePatient(patient1.address)
      ).to.be.revertedWith("Only owner can call this function");
    });

    it("Should fail if patient not active", async function () {
      await patientRegistry.connect(owner).deactivatePatient(patient1.address);

      await expect(
        patientRegistry.connect(owner).deactivatePatient(patient1.address)
      ).to.be.revertedWith("Patient not active");
    });
  });

  describe("Get Patient Data", function () {
    beforeEach(async function () {
      const memberID = "MEM123456";
      const encryptedData = "0x" + Buffer.from("encrypted patient data").toString("hex");
      await patientRegistry.connect(patient1).registerPatient(memberID, encryptedData);
    });

    it("Should allow patient to get their own data", async function () {
      const encryptedData = "0x" + Buffer.from("encrypted patient data").toString("hex");
      const patientData = await patientRegistry.connect(patient1).getPatientData(patient1.address);
      expect(patientData).to.equal(encryptedData);
    });

    it("Should allow owner to get patient data", async function () {
      const encryptedData = "0x" + Buffer.from("encrypted patient data").toString("hex");
      const patientData = await patientRegistry.connect(owner).getPatientData(patient1.address);
      expect(patientData).to.equal(encryptedData);
    });

    it("Should fail if not patient or owner", async function () {
      await expect(
        patientRegistry.connect(patient2).getPatientData(patient1.address)
      ).to.be.revertedWith("Only patient or owner can call this function");
    });

    it("Should fail if patient not registered", async function () {
      await expect(
        patientRegistry.connect(owner).getPatientData(patient2.address)
      ).to.be.revertedWith("Patient not registered");
    });
  });

  describe("Utility Functions", function () {
    it("Should check member ID registration status", async function () {
      const memberID = "MEM123456";
      expect(await patientRegistry.checkMemberID(memberID)).to.equal(false);

      const encryptedData = "0x" + Buffer.from("encrypted patient data").toString("hex");
      await patientRegistry.connect(patient1).registerPatient(memberID, encryptedData);

      expect(await patientRegistry.checkMemberID(memberID)).to.equal(true);
    });

    it("Should return patient address by member ID", async function () {
      const memberID = "MEM123456";
      const encryptedData = "0x" + Buffer.from("encrypted patient data").toString("hex");
      await patientRegistry.connect(patient1).registerPatient(memberID, encryptedData);

      expect(await patientRegistry.getPatientAddressByMemberID(memberID)).to.equal(patient1.address);
    });

    it("Should check if patient is registered", async function () {
      expect(await patientRegistry.connect(patient1).isRegistered()).to.equal(false);

      const memberID = "MEM123456";
      const encryptedData = "0x" + Buffer.from("encrypted patient data").toString("hex");
      await patientRegistry.connect(patient1).registerPatient(memberID, encryptedData);

      expect(await patientRegistry.connect(patient1).isRegistered()).to.equal(true);
    });

    it("Should get patient's own member ID", async function () {
      const memberID = "MEM123456";
      const encryptedData = "0x" + Buffer.from("encrypted patient data").toString("hex");
      await patientRegistry.connect(patient1).registerPatient(memberID, encryptedData);

      expect(await patientRegistry.connect(patient1).getMyMemberID()).to.equal(memberID);
    });

    it("Should fail to get member ID if not registered", async function () {
      await expect(
        patientRegistry.connect(patient1).getMyMemberID()
      ).to.be.revertedWith("You are not registered");
    });
  });

  describe("Transfer Ownership", function () {
    it("Should transfer ownership successfully", async function () {
      await patientRegistry.connect(owner).transferOwnership(patient1.address);
      expect(await patientRegistry.owner()).to.equal(patient1.address);
    });

    it("Should fail if not called by owner", async function () {
      await expect(
        patientRegistry.connect(patient1).transferOwnership(patient2.address)
      ).to.be.revertedWith("Only owner can call this function");
    });

    it("Should fail if new owner is zero address", async function () {
      await expect(
        patientRegistry.connect(owner).transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("New owner cannot be zero address");
    });
  });

  describe("Get All Patient Addresses", function () {
    it("Should return all patient addresses (owner only)", async function () {
      const memberID1 = "MEM123456";
      const memberID2 = "MEM789012";
      const encryptedData = "0x" + Buffer.from("encrypted patient data").toString("hex");

      await patientRegistry.connect(patient1).registerPatient(memberID1, encryptedData);
      await patientRegistry.connect(patient2).registerPatient(memberID2, encryptedData);

      const addresses = await patientRegistry.connect(owner).getAllPatientAddresses();
      expect(addresses.length).to.equal(2);
      expect(addresses[0]).to.equal(patient1.address);
      expect(addresses[1]).to.equal(patient2.address);
    });

    it("Should fail if not called by owner", async function () {
      await expect(
        patientRegistry.connect(patient1).getAllPatientAddresses()
      ).to.be.revertedWith("Only owner can call this function");
    });
  });

  describe("Get Patient Address at Index", function () {
    beforeEach(async function () {
      const memberID1 = "MEM123456";
      const memberID2 = "MEM789012";
      const encryptedData = "0x" + Buffer.from("encrypted patient data").toString("hex");

      await patientRegistry.connect(patient1).registerPatient(memberID1, encryptedData);
      await patientRegistry.connect(patient2).registerPatient(memberID2, encryptedData);
    });

    it("Should return patient address at valid index", async function () {
      expect(await patientRegistry.connect(owner).getPatientAddressAtIndex(0)).to.equal(patient1.address);
      expect(await patientRegistry.connect(owner).getPatientAddressAtIndex(1)).to.equal(patient2.address);
    });

    it("Should fail if index out of bounds", async function () {
      await expect(
        patientRegistry.connect(owner).getPatientAddressAtIndex(5)
      ).to.be.revertedWith("Index out of bounds");
    });

    it("Should fail if not called by owner", async function () {
      await expect(
        patientRegistry.connect(patient1).getPatientAddressAtIndex(0)
      ).to.be.revertedWith("Only owner can call this function");
    });
  });
});
