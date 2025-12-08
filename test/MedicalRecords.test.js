const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MedicalRecords Contract", function () {
  let medicalRecords;
  let owner;
  let patient1;
  let patient2;
  let unauthorized;

  beforeEach(async function () {
    [owner, patient1, patient2, unauthorized] = await ethers.getSigners();

    const MedicalRecords = await ethers.getContractFactory("MedicalRecords");
    medicalRecords = await MedicalRecords.deploy();
    await medicalRecords.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await medicalRecords.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero total records", async function () {
      expect(await medicalRecords.totalRecordsStored()).to.equal(0);
    });
  });

  describe("Patient Authorization", function () {
    it("Should authorize a patient successfully", async function () {
      await medicalRecords.connect(owner).authorizePatient(patient1.address);
      expect(await medicalRecords.isPatientAuthorized(patient1.address)).to.equal(true);
    });

    it("Should emit PatientAuthorized event", async function () {
      await expect(medicalRecords.connect(owner).authorizePatient(patient1.address))
        .to.emit(medicalRecords, "PatientAuthorized")
        .withArgs(patient1.address, await ethers.provider.getBlock("latest").then(b => b.timestamp + 1));
    });

    it("Should fail if not called by owner", async function () {
      await expect(
        medicalRecords.connect(patient1).authorizePatient(patient2.address)
      ).to.be.revertedWith("Only owner can call this function");
    });

    it("Should fail if address is zero", async function () {
      await expect(
        medicalRecords.connect(owner).authorizePatient(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });

    it("Should allow checking authorization status", async function () {
      expect(await medicalRecords.connect(patient1).amIAuthorized()).to.equal(false);

      await medicalRecords.connect(owner).authorizePatient(patient1.address);

      expect(await medicalRecords.connect(patient1).amIAuthorized()).to.equal(true);
    });
  });

  describe("Patient Deauthorization", function () {
    beforeEach(async function () {
      await medicalRecords.connect(owner).authorizePatient(patient1.address);
    });

    it("Should deauthorize a patient successfully", async function () {
      await medicalRecords.connect(owner).deauthorizePatient(patient1.address);
      expect(await medicalRecords.isPatientAuthorized(patient1.address)).to.equal(false);
    });

    it("Should emit PatientDeauthorized event", async function () {
      await expect(medicalRecords.connect(owner).deauthorizePatient(patient1.address))
        .to.emit(medicalRecords, "PatientDeauthorized")
        .withArgs(patient1.address, await ethers.provider.getBlock("latest").then(b => b.timestamp + 1));
    });

    it("Should fail if not called by owner", async function () {
      await expect(
        medicalRecords.connect(patient1).deauthorizePatient(patient1.address)
      ).to.be.revertedWith("Only owner can call this function");
    });
  });

  describe("Add Medical Record", function () {
    beforeEach(async function () {
      await medicalRecords.connect(owner).authorizePatient(patient1.address);
    });

    it("Should add medical record successfully", async function () {
      const recordId = "REC001";
      const dataHash = ethers.id("encrypted medical data");
      const recordType = "lab";
      const metadata = JSON.stringify({ title: "Blood Test", date: "2025-01-15" });

      await medicalRecords.connect(patient1).addMedicalRecord(recordId, dataHash, recordType, metadata);

      expect(await medicalRecords.totalRecordsStored()).to.equal(1);
      expect(await medicalRecords.getPatientRecordCount(patient1.address)).to.equal(1);
    });

    it("Should emit MedicalRecordAdded event", async function () {
      const recordId = "REC001";
      const dataHash = ethers.id("encrypted medical data");
      const recordType = "lab";
      const metadata = JSON.stringify({ title: "Blood Test" });

      await expect(
        medicalRecords.connect(patient1).addMedicalRecord(recordId, dataHash, recordType, metadata)
      )
        .to.emit(medicalRecords, "MedicalRecordAdded")
        .withArgs(patient1.address, recordId, recordType, await ethers.provider.getBlock("latest").then(b => b.timestamp + 1), patient1.address);
    });

    it("Should fail if not authorized", async function () {
      const recordId = "REC001";
      const dataHash = ethers.id("encrypted medical data");
      const recordType = "lab";
      const metadata = JSON.stringify({ title: "Blood Test" });

      await expect(
        medicalRecords.connect(unauthorized).addMedicalRecord(recordId, dataHash, recordType, metadata)
      ).to.be.revertedWith("Not authorized to add records");
    });

    it("Should fail if record ID is empty", async function () {
      const dataHash = ethers.id("encrypted medical data");
      const recordType = "lab";
      const metadata = JSON.stringify({ title: "Blood Test" });

      await expect(
        medicalRecords.connect(patient1).addMedicalRecord("", dataHash, recordType, metadata)
      ).to.be.revertedWith("Record ID cannot be empty");
    });

    it("Should fail if data hash is empty", async function () {
      const recordId = "REC001";
      const recordType = "lab";
      const metadata = JSON.stringify({ title: "Blood Test" });

      await expect(
        medicalRecords.connect(patient1).addMedicalRecord(recordId, "", recordType, metadata)
      ).to.be.revertedWith("Data hash cannot be empty");
    });

    it("Should fail if record ID already exists", async function () {
      const recordId = "REC001";
      const dataHash = ethers.id("encrypted medical data");
      const recordType = "lab";
      const metadata = JSON.stringify({ title: "Blood Test" });

      await medicalRecords.connect(patient1).addMedicalRecord(recordId, dataHash, recordType, metadata);

      await expect(
        medicalRecords.connect(patient1).addMedicalRecord(recordId, dataHash, recordType, metadata)
      ).to.be.revertedWith("Record ID already exists");
    });

    it("Should store record correctly", async function () {
      const recordId = "REC001";
      const dataHash = ethers.id("encrypted medical data");
      const recordType = "lab";
      const metadata = JSON.stringify({ title: "Blood Test" });

      await medicalRecords.connect(patient1).addMedicalRecord(recordId, dataHash, recordType, metadata);

      const record = await medicalRecords.getMedicalRecord(patient1.address, 0);
      expect(record.recordId).to.equal(recordId);
      expect(record.encryptedDataHash).to.equal(dataHash);
      expect(record.recordType).to.equal(recordType);
      expect(record.uploadedBy).to.equal(patient1.address);
      expect(record.isActive).to.equal(true);
      expect(record.metadata).to.equal(metadata);
    });

    it("Should increment patient record count", async function () {
      const records = [
        { id: "REC001", type: "lab" },
        { id: "REC002", type: "prescription" },
        { id: "REC003", type: "imaging" }
      ];

      for (const rec of records) {
        await medicalRecords.connect(patient1).addMedicalRecord(
          rec.id,
          ethers.id("data"),
          rec.type,
          "{}"
        );
      }

      expect(await medicalRecords.getPatientRecordCount(patient1.address)).to.equal(3);
      expect(await medicalRecords.connect(patient1).getMyRecordCount()).to.equal(3);
    });

    it("Should allow owner to add records", async function () {
      const recordId = "REC001";
      const dataHash = ethers.id("encrypted medical data");
      const recordType = "lab";
      const metadata = JSON.stringify({ title: "Blood Test" });

      await medicalRecords.connect(owner).addMedicalRecord(recordId, dataHash, recordType, metadata);

      expect(await medicalRecords.totalRecordsStored()).to.equal(1);
    });
  });

  describe("Update Medical Record", function () {
    beforeEach(async function () {
      await medicalRecords.connect(owner).authorizePatient(patient1.address);
      
      await medicalRecords.connect(patient1).addMedicalRecord(
        "REC001",
        ethers.id("original data"),
        "lab",
        JSON.stringify({ title: "Original" })
      );
    });

    it("Should update medical record successfully", async function () {
      const newDataHash = ethers.id("updated data");
      const newMetadata = JSON.stringify({ title: "Updated" });

      await medicalRecords.connect(patient1).updateMedicalRecord(0, newDataHash, newMetadata);

      const record = await medicalRecords.getMedicalRecord(patient1.address, 0);
      expect(record.encryptedDataHash).to.equal(newDataHash);
      expect(record.metadata).to.equal(newMetadata);
    });

    it("Should emit MedicalRecordUpdated event", async function () {
      const newDataHash = ethers.id("updated data");
      const newMetadata = JSON.stringify({ title: "Updated" });

      await expect(
        medicalRecords.connect(patient1).updateMedicalRecord(0, newDataHash, newMetadata)
      )
        .to.emit(medicalRecords, "MedicalRecordUpdated")
        .withArgs(patient1.address, "REC001", await ethers.provider.getBlock("latest").then(b => b.timestamp + 1));
    });

    it("Should fail if not authorized", async function () {
      const newDataHash = ethers.id("updated data");
      const newMetadata = JSON.stringify({ title: "Updated" });

      await expect(
        medicalRecords.connect(unauthorized).updateMedicalRecord(0, newDataHash, newMetadata)
      ).to.be.revertedWith("Not authorized to add records");
    });

    it("Should fail if record index invalid", async function () {
      const newDataHash = ethers.id("updated data");
      const newMetadata = JSON.stringify({ title: "Updated" });

      await expect(
        medicalRecords.connect(patient1).updateMedicalRecord(5, newDataHash, newMetadata)
      ).to.be.revertedWith("Invalid record index");
    });

    it("Should fail if record not active", async function () {
      await medicalRecords.connect(patient1).deactivateMedicalRecord(0);

      const newDataHash = ethers.id("updated data");
      const newMetadata = JSON.stringify({ title: "Updated" });

      await expect(
        medicalRecords.connect(patient1).updateMedicalRecord(0, newDataHash, newMetadata)
      ).to.be.revertedWith("Record not active");
    });

    it("Should fail if data hash is empty", async function () {
      const newMetadata = JSON.stringify({ title: "Updated" });

      await expect(
        medicalRecords.connect(patient1).updateMedicalRecord(0, "", newMetadata)
      ).to.be.revertedWith("Data hash cannot be empty");
    });
  });

  describe("Deactivate Medical Record", function () {
    beforeEach(async function () {
      await medicalRecords.connect(owner).authorizePatient(patient1.address);
      
      await medicalRecords.connect(patient1).addMedicalRecord(
        "REC001",
        ethers.id("data"),
        "lab",
        "{}"
      );
    });

    it("Should deactivate medical record successfully", async function () {
      await medicalRecords.connect(patient1).deactivateMedicalRecord(0);

      const record = await medicalRecords.getMedicalRecord(patient1.address, 0);
      expect(record.isActive).to.equal(false);
    });

    it("Should emit MedicalRecordDeactivated event", async function () {
      await expect(medicalRecords.connect(patient1).deactivateMedicalRecord(0))
        .to.emit(medicalRecords, "MedicalRecordDeactivated")
        .withArgs(patient1.address, "REC001", await ethers.provider.getBlock("latest").then(b => b.timestamp + 1));
    });

    it("Should fail if not authorized", async function () {
      await expect(
        medicalRecords.connect(unauthorized).deactivateMedicalRecord(0)
      ).to.be.revertedWith("Not authorized to add records");
    });

    it("Should fail if record index invalid", async function () {
      await expect(
        medicalRecords.connect(patient1).deactivateMedicalRecord(5)
      ).to.be.revertedWith("Invalid record index");
    });

    it("Should fail if record already inactive", async function () {
      await medicalRecords.connect(patient1).deactivateMedicalRecord(0);

      await expect(
        medicalRecords.connect(patient1).deactivateMedicalRecord(0)
      ).to.be.revertedWith("Record already inactive");
    });
  });

  describe("Get Medical Record", function () {
    beforeEach(async function () {
      await medicalRecords.connect(owner).authorizePatient(patient1.address);
      
      await medicalRecords.connect(patient1).addMedicalRecord(
        "REC001",
        ethers.id("data"),
        "lab",
        JSON.stringify({ title: "Test" })
      );
    });

    it("Should allow patient to get their own record", async function () {
      const record = await medicalRecords.connect(patient1).getMedicalRecord(patient1.address, 0);
      expect(record.recordId).to.equal("REC001");
    });

    it("Should allow owner to get any record", async function () {
      const record = await medicalRecords.connect(owner).getMedicalRecord(patient1.address, 0);
      expect(record.recordId).to.equal("REC001");
    });

    it("Should fail if not patient or owner", async function () {
      await expect(
        medicalRecords.connect(patient2).getMedicalRecord(patient1.address, 0)
      ).to.be.revertedWith("Only patient or owner can access");
    });

    it("Should fail if record index invalid", async function () {
      await expect(
        medicalRecords.connect(patient1).getMedicalRecord(patient1.address, 5)
      ).to.be.revertedWith("Invalid record index");
    });

    it("Should return all record fields correctly", async function () {
      const record = await medicalRecords.connect(patient1).getMedicalRecord(patient1.address, 0);
      
      expect(record.recordId).to.equal("REC001");
      expect(record.encryptedDataHash).to.equal(ethers.id("data"));
      expect(record.recordType).to.equal("lab");
      expect(record.uploadedBy).to.equal(patient1.address);
      expect(record.isActive).to.equal(true);
      expect(record.metadata).to.equal(JSON.stringify({ title: "Test" }));
      expect(record.timestamp).to.be.gt(0);
    });
  });

  describe("Get Patient Record IDs", function () {
    beforeEach(async function () {
      await medicalRecords.connect(owner).authorizePatient(patient1.address);
    });

    it("Should return empty array if no records", async function () {
      const recordIds = await medicalRecords.connect(patient1).getPatientRecordIds(patient1.address);
      expect(recordIds.length).to.equal(0);
    });

    it("Should return all active record IDs", async function () {
      const records = ["REC001", "REC002", "REC003"];
      
      for (const id of records) {
        await medicalRecords.connect(patient1).addMedicalRecord(id, ethers.id("data"), "lab", "{}");
      }

      const recordIds = await medicalRecords.connect(patient1).getPatientRecordIds(patient1.address);
      expect(recordIds.length).to.equal(3);
      expect(recordIds[0]).to.equal("REC001");
      expect(recordIds[1]).to.equal("REC002");
      expect(recordIds[2]).to.equal("REC003");
    });

    it("Should exclude inactive records", async function () {
      await medicalRecords.connect(patient1).addMedicalRecord("REC001", ethers.id("data"), "lab", "{}");
      await medicalRecords.connect(patient1).addMedicalRecord("REC002", ethers.id("data"), "lab", "{}");
      await medicalRecords.connect(patient1).addMedicalRecord("REC003", ethers.id("data"), "lab", "{}");

      await medicalRecords.connect(patient1).deactivateMedicalRecord(1); // Deactivate REC002

      const recordIds = await medicalRecords.connect(patient1).getPatientRecordIds(patient1.address);
      expect(recordIds.length).to.equal(2);
      expect(recordIds[0]).to.equal("REC001");
      expect(recordIds[1]).to.equal("REC003");
    });

    it("Should fail if not patient or owner", async function () {
      await expect(
        medicalRecords.connect(patient2).getPatientRecordIds(patient1.address)
      ).to.be.revertedWith("Only patient or owner can access");
    });
  });

  describe("Transfer Ownership", function () {
    it("Should transfer ownership successfully", async function () {
      await medicalRecords.connect(owner).transferOwnership(patient1.address);
      expect(await medicalRecords.owner()).to.equal(patient1.address);
    });

    it("Should fail if not called by owner", async function () {
      await expect(
        medicalRecords.connect(patient1).transferOwnership(patient2.address)
      ).to.be.revertedWith("Only owner can call this function");
    });

    it("Should fail if new owner is zero address", async function () {
      await expect(
        medicalRecords.connect(owner).transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWith("New owner cannot be zero address");
    });
  });

  describe("Multiple Patients Scenario", function () {
    beforeEach(async function () {
      await medicalRecords.connect(owner).authorizePatient(patient1.address);
      await medicalRecords.connect(owner).authorizePatient(patient2.address);
    });

    it("Should handle multiple patients with separate records", async function () {
      // Patient 1 records
      await medicalRecords.connect(patient1).addMedicalRecord("REC001", ethers.id("data1"), "lab", "{}");
      await medicalRecords.connect(patient1).addMedicalRecord("REC002", ethers.id("data2"), "prescription", "{}");

      // Patient 2 records
      await medicalRecords.connect(patient2).addMedicalRecord("REC003", ethers.id("data3"), "imaging", "{}");

      expect(await medicalRecords.getPatientRecordCount(patient1.address)).to.equal(2);
      expect(await medicalRecords.getPatientRecordCount(patient2.address)).to.equal(1);
      expect(await medicalRecords.totalRecordsStored()).to.equal(3);
    });

    it("Should not allow patient to access other patient's records", async function () {
      await medicalRecords.connect(patient1).addMedicalRecord("REC001", ethers.id("data"), "lab", "{}");

      await expect(
        medicalRecords.connect(patient2).getMedicalRecord(patient1.address, 0)
      ).to.be.revertedWith("Only patient or owner can access");
    });
  });

  describe("Record Types", function () {
    beforeEach(async function () {
      await medicalRecords.connect(owner).authorizePatient(patient1.address);
    });

    it("Should support different record types", async function () {
      const recordTypes = ["lab", "prescription", "imaging", "visit", "vaccination", "surgery", "discharge", "other"];

      for (let i = 0; i < recordTypes.length; i++) {
        await medicalRecords.connect(patient1).addMedicalRecord(
          `REC00${i}`,
          ethers.id(`data${i}`),
          recordTypes[i],
          "{}"
        );
      }

      for (let i = 0; i < recordTypes.length; i++) {
        const record = await medicalRecords.getMedicalRecord(patient1.address, i);
        expect(record.recordType).to.equal(recordTypes[i]);
      }
    });
  });

  describe("Edge Cases", function () {
    beforeEach(async function () {
      await medicalRecords.connect(owner).authorizePatient(patient1.address);
    });

    it("Should handle large metadata", async function () {
      const largeMetadata = JSON.stringify({
        title: "Test Record",
        description: "A".repeat(1000),
        additionalInfo: "B".repeat(1000)
      });

      await medicalRecords.connect(patient1).addMedicalRecord(
        "REC001",
        ethers.id("data"),
        "lab",
        largeMetadata
      );

      const record = await medicalRecords.getMedicalRecord(patient1.address, 0);
      expect(record.metadata).to.equal(largeMetadata);
    });

    it("Should handle special characters in record ID", async function () {
      const specialRecordId = "REC-001_TEST@2025#456";

      await medicalRecords.connect(patient1).addMedicalRecord(
        specialRecordId,
        ethers.id("data"),
        "lab",
        "{}"
      );

      const record = await medicalRecords.getMedicalRecord(patient1.address, 0);
      expect(record.recordId).to.equal(specialRecordId);
    });

    it("Should handle empty metadata", async function () {
      await medicalRecords.connect(patient1).addMedicalRecord(
        "REC001",
        ethers.id("data"),
        "lab",
        ""
      );

      const record = await medicalRecords.getMedicalRecord(patient1.address, 0);
      expect(record.metadata).to.equal("");
    });
  });

  describe("Set PatientRegistry Contract", function () {
    it("Should set PatientRegistry contract address", async function () {
      const mockRegistryAddress = patient2.address;
      
      await medicalRecords.connect(owner).setPatientRegistryContract(mockRegistryAddress);
      
      expect(await medicalRecords.patientRegistryContract()).to.equal(mockRegistryAddress);
    });

    it("Should fail if not called by owner", async function () {
      await expect(
        medicalRecords.connect(patient1).setPatientRegistryContract(patient2.address)
      ).to.be.revertedWith("Only owner can call this function");
    });
  });
});
