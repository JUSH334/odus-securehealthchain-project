const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Integration Tests - Full System", function () {
  let patientRegistry;
  let medicalRecords;
  let payment;
  let owner;
  let patient1;
  let patient2;
  let provider;

  beforeEach(async function () {
    [owner, patient1, patient2, provider] = await ethers.getSigners();

    // Deploy all contracts
    const PatientRegistry = await ethers.getContractFactory("PatientRegistry");
    patientRegistry = await PatientRegistry.deploy();
    await patientRegistry.waitForDeployment();

    const MedicalRecords = await ethers.getContractFactory("MedicalRecords");
    medicalRecords = await MedicalRecords.deploy();
    await medicalRecords.waitForDeployment();

    const Payment = await ethers.getContractFactory("Payment");
    payment = await Payment.deploy();
    await payment.waitForDeployment();

    // Link MedicalRecords to PatientRegistry
    await medicalRecords.connect(owner).setPatientRegistryContract(await patientRegistry.getAddress());
  });

  describe("Complete Patient Journey", function () {
    it("Should handle full patient lifecycle", async function () {
      // Step 1: Register patient
      const memberID = "MEM123456";
      const encryptedData = "0x" + Buffer.from("patient data").toString("hex");
      
      await patientRegistry.connect(patient1).registerPatient(memberID, encryptedData);
      expect(await patientRegistry.isMemberIDRegistered(memberID)).to.equal(true);

      // Step 2: Assign provider
      await patientRegistry.connect(owner).assignProvider(patient1.address, provider.address);
      const patient = await patientRegistry.getPatient(patient1.address);
      expect(patient.assignedProvider).to.equal(provider.address);

      // Step 3: Authorize for medical records
      await medicalRecords.connect(owner).authorizePatient(patient1.address);
      expect(await medicalRecords.isPatientAuthorized(patient1.address)).to.equal(true);

      // Step 4: Upload medical record
      const recordId = "REC001";
      const dataHash = ethers.id("medical data");
      const recordType = "lab";
      const metadata = JSON.stringify({ title: "Blood Test Results" });

      await medicalRecords.connect(patient1).addMedicalRecord(recordId, dataHash, recordType, metadata);
      expect(await medicalRecords.getPatientRecordCount(patient1.address)).to.equal(1);

      // Step 5: Process payment for medical service
      const paymentId = "PAY001";
      const itemId = "BILL001";
      const amount = ethers.parseEther("0.1");

      await payment.connect(patient1).processPayment(paymentId, itemId, "bill", memberID, { value: amount });
      expect(await payment.isItemPaid(itemId)).to.equal(true);

      // Verify complete system state
      expect(await patientRegistry.totalPatientsRegistered()).to.equal(1);
      expect(await medicalRecords.totalRecordsStored()).to.equal(1);
      expect(await payment.totalPaymentsProcessed()).to.equal(1);
    });

    it("Should handle multiple patients with different records and payments", async function () {
      // Register Patient 1
      await patientRegistry.connect(patient1).registerPatient(
        "MEM001",
        "0x" + Buffer.from("data1").toString("hex")
      );

      // Register Patient 2
      await patientRegistry.connect(patient2).registerPatient(
        "MEM002",
        "0x" + Buffer.from("data2").toString("hex")
      );

      // Authorize both patients for medical records
      await medicalRecords.connect(owner).authorizePatient(patient1.address);
      await medicalRecords.connect(owner).authorizePatient(patient2.address);

      // Patient 1: Add 2 medical records
      await medicalRecords.connect(patient1).addMedicalRecord("REC001", ethers.id("data1"), "lab", "{}");
      await medicalRecords.connect(patient1).addMedicalRecord("REC002", ethers.id("data2"), "prescription", "{}");

      // Patient 2: Add 1 medical record
      await medicalRecords.connect(patient2).addMedicalRecord("REC003", ethers.id("data3"), "imaging", "{}");

      // Patient 1: Make 2 payments
      await payment.connect(patient1).processPayment("PAY001", "ITEM001", "bill", "MEM001", { value: ethers.parseEther("0.1") });
      await payment.connect(patient1).processPayment("PAY002", "ITEM002", "prescription", "MEM001", { value: ethers.parseEther("0.05") });

      // Patient 2: Make 1 payment
      await payment.connect(patient2).processPayment("PAY003", "ITEM003", "imaging", "MEM002", { value: ethers.parseEther("0.2") });

      // Verify Patient 1
      expect(await medicalRecords.getPatientRecordCount(patient1.address)).to.equal(2);
      const patient1Payments = await payment.getUserPayments(patient1.address);
      expect(patient1Payments.length).to.equal(2);

      // Verify Patient 2
      expect(await medicalRecords.getPatientRecordCount(patient2.address)).to.equal(1);
      const patient2Payments = await payment.getUserPayments(patient2.address);
      expect(patient2Payments.length).to.equal(1);

      // Verify totals
      expect(await patientRegistry.totalPatientsRegistered()).to.equal(2);
      expect(await medicalRecords.totalRecordsStored()).to.equal(3);
      expect(await payment.totalPaymentsProcessed()).to.equal(3);
    });
  });

  describe("Cross-Contract Authorization", function () {
    it("Should maintain separate authorization for registry and records", async function () {
      const memberID = "MEM123456";
      const encryptedData = "0x" + Buffer.from("data").toString("hex");

      // Patient can register without medical records authorization
      await patientRegistry.connect(patient1).registerPatient(memberID, encryptedData);
      expect(await patientRegistry.connect(patient1).isRegistered()).to.equal(true);
      expect(await medicalRecords.isPatientAuthorized(patient1.address)).to.equal(false);

      // Cannot add medical records without authorization
      await expect(
        medicalRecords.connect(patient1).addMedicalRecord("REC001", ethers.id("data"), "lab", "{}")
      ).to.be.revertedWith("Not authorized to add records");

      // After authorization, can add records
      await medicalRecords.connect(owner).authorizePatient(patient1.address);
      await medicalRecords.connect(patient1).addMedicalRecord("REC001", ethers.id("data"), "lab", "{}");
      expect(await medicalRecords.getPatientRecordCount(patient1.address)).to.equal(1);
    });
  });

  describe("Payment for Medical Services", function () {
    beforeEach(async function () {
      // Setup: Register patient and authorize for records
      await patientRegistry.connect(patient1).registerPatient(
        "MEM123456",
        "0x" + Buffer.from("data").toString("hex")
      );
      await medicalRecords.connect(owner).authorizePatient(patient1.address);
    });

    it("Should link payment to medical service correctly", async function () {
      // Add medical record
      const recordId = "REC001";
      await medicalRecords.connect(patient1).addMedicalRecord(
        recordId,
        ethers.id("data"),
        "lab",
        JSON.stringify({ title: "Blood Test", cost: "0.1 ETH" })
      );

      // Process payment for this service
      const paymentId = "PAY001";
      const itemId = recordId; // Using record ID as item ID
      const amount = ethers.parseEther("0.1");

      await payment.connect(patient1).processPayment(paymentId, itemId, "lab", "MEM123456", { value: amount });

      // Verify payment
      const paymentRecord = await payment.getPayment(paymentId);
      expect(paymentRecord.itemId).to.equal(recordId);
      expect(paymentRecord.itemType).to.equal("lab");
      expect(paymentRecord.memberID).to.equal("MEM123456");
      expect(paymentRecord.amount).to.equal(amount);
      expect(await payment.isItemPaid(recordId)).to.equal(true);
    });

    it("Should prevent double payment for same medical service", async function () {
      const recordId = "REC001";
      await medicalRecords.connect(patient1).addMedicalRecord(recordId, ethers.id("data"), "lab", "{}");

      const amount = ethers.parseEther("0.1");
      
      // First payment succeeds
      await payment.connect(patient1).processPayment("PAY001", recordId, "lab", "MEM123456", { value: amount });

      // Second payment for same item fails
      await expect(
        payment.connect(patient1).processPayment("PAY002", recordId, "lab", "MEM123456", { value: amount })
      ).to.be.revertedWith("Item already paid");
    });
  });

  describe("Owner Administrative Functions", function () {
    beforeEach(async function () {
      await patientRegistry.connect(patient1).registerPatient(
        "MEM123456",
        "0x" + Buffer.from("data").toString("hex")
      );
    });

    it("Should allow owner to manage all systems", async function () {
      // Assign provider in registry
      await patientRegistry.connect(owner).assignProvider(patient1.address, provider.address);

      // Authorize patient for medical records
      await medicalRecords.connect(owner).authorizePatient(patient1.address);

      // Patient can now add records
      await medicalRecords.connect(patient1).addMedicalRecord("REC001", ethers.id("data"), "lab", "{}");

      // Patient makes payment
      await payment.connect(patient1).processPayment("PAY001", "ITEM001", "bill", "MEM123456", { value: ethers.parseEther("0.1") });

      // Owner can withdraw funds
      const withdrawAmount = ethers.parseEther("0.05");
      await payment.connect(owner).withdraw(withdrawAmount);

      // Owner can deactivate patient
      await patientRegistry.connect(owner).deactivatePatient(patient1.address);
      const patient = await patientRegistry.getPatient(patient1.address);
      expect(patient.isActive).to.equal(false);

      // Owner can deauthorize patient
      await medicalRecords.connect(owner).deauthorizePatient(patient1.address);
      expect(await medicalRecords.isPatientAuthorized(patient1.address)).to.equal(false);
    });

    it("Should maintain owner permissions across all contracts", async function () {
      expect(await patientRegistry.owner()).to.equal(owner.address);
      expect(await medicalRecords.owner()).to.equal(owner.address);
      expect(await payment.owner()).to.equal(owner.address);
    });
  });

  describe("Data Consistency", function () {
    it("Should maintain consistent member IDs across systems", async function () {
      const memberID = "MEM123456";
      const encryptedData = "0x" + Buffer.from("data").toString("hex");

      // Register with member ID
      await patientRegistry.connect(patient1).registerPatient(memberID, encryptedData);

      // Verify member ID in registry
      expect(await patientRegistry.connect(patient1).getMyMemberID()).to.equal(memberID);

      // Use same member ID in payment
      await payment.connect(patient1).processPayment(
        "PAY001",
        "ITEM001",
        "bill",
        memberID,
        { value: ethers.parseEther("0.1") }
      );

      // Verify member ID in payment
      const paymentRecord = await payment.getPayment("PAY001");
      expect(paymentRecord.memberID).to.equal(memberID);
    });
  });

  describe("Security and Access Control", function () {
    beforeEach(async function () {
      await patientRegistry.connect(patient1).registerPatient(
        "MEM001",
        "0x" + Buffer.from("data1").toString("hex")
      );
      await patientRegistry.connect(patient2).registerPatient(
        "MEM002",
        "0x" + Buffer.from("data2").toString("hex")
      );

      await medicalRecords.connect(owner).authorizePatient(patient1.address);
      await medicalRecords.connect(owner).authorizePatient(patient2.address);

      await medicalRecords.connect(patient1).addMedicalRecord("REC001", ethers.id("data1"), "lab", "{}");
      await medicalRecords.connect(patient2).addMedicalRecord("REC002", ethers.id("data2"), "lab", "{}");
    });

    it("Should enforce patient data isolation", async function () {
      // Patient 1 can access their own data
      const patient1Data = await patientRegistry.connect(patient1).getPatientData(patient1.address);
      expect(patient1Data).to.not.equal("");

      // Patient 1 cannot access Patient 2's data
      await expect(
        patientRegistry.connect(patient1).getPatientData(patient2.address)
      ).to.be.revertedWith("Only patient or owner can call this function");

      // Patient 1 cannot access Patient 2's medical records
      await expect(
        medicalRecords.connect(patient1).getMedicalRecord(patient2.address, 0)
      ).to.be.revertedWith("Only patient or owner can access");
    });

    it("Should allow owner to access all patient data", async function () {
      // Owner can access Patient 1's data
      const patient1Data = await patientRegistry.connect(owner).getPatientData(patient1.address);
      expect(patient1Data).to.not.equal("");

      // Owner can access Patient 2's data
      const patient2Data = await patientRegistry.connect(owner).getPatientData(patient2.address);
      expect(patient2Data).to.not.equal("");

      // Owner can access Patient 1's medical records
      const record1 = await medicalRecords.connect(owner).getMedicalRecord(patient1.address, 0);
      expect(record1.recordId).to.equal("REC001");

      // Owner can access Patient 2's medical records
      const record2 = await medicalRecords.connect(owner).getMedicalRecord(patient2.address, 0);
      expect(record2.recordId).to.equal("REC002");
    });
  });

  describe("Statistics and Reporting", function () {
    it("Should provide accurate system-wide statistics", async function () {
      // Register 3 patients
      await patientRegistry.connect(patient1).registerPatient("MEM001", "0x" + Buffer.from("data1").toString("hex"));
      await patientRegistry.connect(patient2).registerPatient("MEM002", "0x" + Buffer.from("data2").toString("hex"));
      
      const [,,,otherPatient] = await ethers.getSigners();
      await patientRegistry.connect(otherPatient).registerPatient("MEM003", "0x" + Buffer.from("data3").toString("hex"));

      // Authorize all for medical records
      await medicalRecords.connect(owner).authorizePatient(patient1.address);
      await medicalRecords.connect(owner).authorizePatient(patient2.address);
      await medicalRecords.connect(owner).authorizePatient(otherPatient.address);

      // Add medical records
      await medicalRecords.connect(patient1).addMedicalRecord("REC001", ethers.id("data1"), "lab", "{}");
      await medicalRecords.connect(patient1).addMedicalRecord("REC002", ethers.id("data2"), "prescription", "{}");
      await medicalRecords.connect(patient2).addMedicalRecord("REC003", ethers.id("data3"), "imaging", "{}");

      // Process payments
      await payment.connect(patient1).processPayment("PAY001", "ITEM001", "bill", "MEM001", { value: ethers.parseEther("0.1") });
      await payment.connect(patient2).processPayment("PAY002", "ITEM002", "bill", "MEM002", { value: ethers.parseEther("0.2") });
      await payment.connect(otherPatient).processPayment("PAY003", "ITEM003", "bill", "MEM003", { value: ethers.parseEther("0.15") });

      // Verify statistics
      expect(await patientRegistry.totalPatientsRegistered()).to.equal(3);
      expect(await medicalRecords.totalRecordsStored()).to.equal(3);
      
      const paymentStats = await payment.getStats();
      expect(paymentStats[0]).to.equal(3); // totalPaymentsProcessed
      expect(paymentStats[1]).to.equal(ethers.parseEther("0.45")); // totalAmountProcessed
    });
  });

  describe("Contract Linking", function () {
    it("Should verify MedicalRecords linked to PatientRegistry", async function () {
      const registryAddress = await patientRegistry.getAddress();
      expect(await medicalRecords.patientRegistryContract()).to.equal(registryAddress);
    });

    it("Should allow updating registry link", async function () {
      const newRegistryAddress = patient1.address; // Using patient address as mock
      
      await medicalRecords.connect(owner).setPatientRegistryContract(newRegistryAddress);
      expect(await medicalRecords.patientRegistryContract()).to.equal(newRegistryAddress);
    });
  });

  describe("Event Emission Across Contracts", function () {
    it("Should emit events from all contracts in one transaction flow", async function () {
      const memberID = "MEM123456";
      const encryptedData = "0x" + Buffer.from("data").toString("hex");

      // Register patient - emits PatientRegistered
      const tx1 = await patientRegistry.connect(patient1).registerPatient(memberID, encryptedData);
      await expect(tx1).to.emit(patientRegistry, "PatientRegistered");

      // Authorize patient - emits PatientAuthorized
      const tx2 = await medicalRecords.connect(owner).authorizePatient(patient1.address);
      await expect(tx2).to.emit(medicalRecords, "PatientAuthorized");

      // Add record - emits MedicalRecordAdded
      const tx3 = await medicalRecords.connect(patient1).addMedicalRecord("REC001", ethers.id("data"), "lab", "{}");
      await expect(tx3).to.emit(medicalRecords, "MedicalRecordAdded");

      // Process payment - emits PaymentProcessed and PaymentReceived
      const tx4 = await payment.connect(patient1).processPayment("PAY001", "ITEM001", "bill", memberID, { value: ethers.parseEther("0.1") });
      await expect(tx4).to.emit(payment, "PaymentProcessed");
      await expect(tx4).to.emit(payment, "PaymentReceived");
    });
  });

  describe("Error Handling Across Contracts", function () {
    it("Should handle errors gracefully when operations fail", async function () {
      // Cannot add medical record without registration
      await expect(
        medicalRecords.connect(patient1).addMedicalRecord("REC001", ethers.id("data"), "lab", "{}")
      ).to.be.revertedWith("Not authorized to add records");

      // Cannot process payment with zero amount
      await expect(
        payment.connect(patient1).processPayment("PAY001", "ITEM001", "bill", "MEM123456", { value: 0 })
      ).to.be.revertedWith("Payment amount must be greater than 0");

      // Cannot update data if not registered
      await expect(
        patientRegistry.connect(patient1).updatePatientData("0x" + Buffer.from("new data").toString("hex"))
      ).to.be.revertedWith("Patient not registered");
    });
  });
});
