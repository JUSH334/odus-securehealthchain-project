const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Payment Contract", function () {
  let payment;
  let owner;
  let payer1;
  let payer2;

  beforeEach(async function () {
    [owner, payer1, payer2] = await ethers.getSigners();

    const Payment = await ethers.getContractFactory("Payment");
    payment = await Payment.deploy();
    await payment.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct owner", async function () {
      expect(await payment.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero payments processed", async function () {
      expect(await payment.totalPaymentsProcessed()).to.equal(0);
    });

    it("Should initialize with zero amount processed", async function () {
      expect(await payment.totalAmountProcessed()).to.equal(0);
    });
  });

  describe("Process Payment", function () {
    it("Should process payment successfully", async function () {
      const paymentId = "PAY001";
      const itemId = "ITEM001";
      const itemType = "bill";
      const memberID = "MEM123456";
      const amount = ethers.parseEther("0.1");

      const tx = await payment.connect(payer1).processPayment(
        paymentId,
        itemId,
        itemType,
        memberID,
        { value: amount }
      );

      await tx.wait();

      expect(await payment.totalPaymentsProcessed()).to.equal(1);
      expect(await payment.totalAmountProcessed()).to.equal(amount);
    });

    it("Should emit PaymentProcessed event", async function () {
      const paymentId = "PAY001";
      const itemId = "ITEM001";
      const itemType = "bill";
      const memberID = "MEM123456";
      const amount = ethers.parseEther("0.1");

      await expect(
        payment.connect(payer1).processPayment(paymentId, itemId, itemType, memberID, { value: amount })
      )
        .to.emit(payment, "PaymentProcessed")
        .withArgs(paymentId, itemId, payer1.address, amount, await ethers.provider.getBlock("latest").then(b => b.timestamp + 1));
    });

    it("Should emit PaymentReceived event", async function () {
      const paymentId = "PAY001";
      const itemId = "ITEM001";
      const itemType = "bill";
      const memberID = "MEM123456";
      const amount = ethers.parseEther("0.1");

      await expect(
        payment.connect(payer1).processPayment(paymentId, itemId, itemType, memberID, { value: amount })
      )
        .to.emit(payment, "PaymentReceived")
        .withArgs(payer1.address, amount);
    });

    it("Should fail if payment amount is zero", async function () {
      const paymentId = "PAY001";
      const itemId = "ITEM001";
      const itemType = "bill";
      const memberID = "MEM123456";

      await expect(
        payment.connect(payer1).processPayment(paymentId, itemId, itemType, memberID, { value: 0 })
      ).to.be.revertedWith("Payment amount must be greater than 0");
    });

    it("Should fail if payment ID is empty", async function () {
      const itemId = "ITEM001";
      const itemType = "bill";
      const memberID = "MEM123456";
      const amount = ethers.parseEther("0.1");

      await expect(
        payment.connect(payer1).processPayment("", itemId, itemType, memberID, { value: amount })
      ).to.be.revertedWith("Payment ID cannot be empty");
    });

    it("Should fail if item ID is empty", async function () {
      const paymentId = "PAY001";
      const itemType = "bill";
      const memberID = "MEM123456";
      const amount = ethers.parseEther("0.1");

      await expect(
        payment.connect(payer1).processPayment(paymentId, "", itemType, memberID, { value: amount })
      ).to.be.revertedWith("Item ID cannot be empty");
    });

    it("Should fail if payment already processed", async function () {
      const paymentId = "PAY001";
      const itemId = "ITEM001";
      const itemType = "bill";
      const memberID = "MEM123456";
      const amount = ethers.parseEther("0.1");

      await payment.connect(payer1).processPayment(paymentId, itemId, itemType, memberID, { value: amount });

      await expect(
        payment.connect(payer1).processPayment(paymentId, "ITEM002", itemType, memberID, { value: amount })
      ).to.be.revertedWith("Payment already processed");
    });

    it("Should fail if item already paid", async function () {
      const paymentId1 = "PAY001";
      const paymentId2 = "PAY002";
      const itemId = "ITEM001";
      const itemType = "bill";
      const memberID = "MEM123456";
      const amount = ethers.parseEther("0.1");

      await payment.connect(payer1).processPayment(paymentId1, itemId, itemType, memberID, { value: amount });

      await expect(
        payment.connect(payer1).processPayment(paymentId2, itemId, itemType, memberID, { value: amount })
      ).to.be.revertedWith("Item already paid");
    });

    it("Should store payment record correctly", async function () {
      const paymentId = "PAY001";
      const itemId = "ITEM001";
      const itemType = "bill";
      const memberID = "MEM123456";
      const amount = ethers.parseEther("0.1");

      await payment.connect(payer1).processPayment(paymentId, itemId, itemType, memberID, { value: amount });

      const paymentRecord = await payment.getPayment(paymentId);
      expect(paymentRecord.itemId).to.equal(itemId);
      expect(paymentRecord.itemType).to.equal(itemType);
      expect(paymentRecord.payer).to.equal(payer1.address);
      expect(paymentRecord.amount).to.equal(amount);
      expect(paymentRecord.completed).to.equal(true);
    });

    it("Should update item paid status", async function () {
      const paymentId = "PAY001";
      const itemId = "ITEM001";
      const itemType = "bill";
      const memberID = "MEM123456";
      const amount = ethers.parseEther("0.1");

      expect(await payment.isItemPaid(itemId)).to.equal(false);

      await payment.connect(payer1).processPayment(paymentId, itemId, itemType, memberID, { value: amount });

      expect(await payment.isItemPaid(itemId)).to.equal(true);
    });

    it("Should add payment to user's payment list", async function () {
      const paymentId = "PAY001";
      const itemId = "ITEM001";
      const itemType = "bill";
      const memberID = "MEM123456";
      const amount = ethers.parseEther("0.1");

      await payment.connect(payer1).processPayment(paymentId, itemId, itemType, memberID, { value: amount });

      const userPayments = await payment.getUserPayments(payer1.address);
      expect(userPayments.length).to.equal(1);
      expect(userPayments[0]).to.equal(paymentId);
    });

    it("Should increment contract balance", async function () {
      const paymentId = "PAY001";
      const itemId = "ITEM001";
      const itemType = "bill";
      const memberID = "MEM123456";
      const amount = ethers.parseEther("0.1");

      const balanceBefore = await ethers.provider.getBalance(await payment.getAddress());

      await payment.connect(payer1).processPayment(paymentId, itemId, itemType, memberID, { value: amount });

      const balanceAfter = await ethers.provider.getBalance(await payment.getAddress());
      expect(balanceAfter - balanceBefore).to.equal(amount);
    });
  });

  describe("Get Payment", function () {
    beforeEach(async function () {
      const paymentId = "PAY001";
      const itemId = "ITEM001";
      const itemType = "bill";
      const memberID = "MEM123456";
      const amount = ethers.parseEther("0.1");

      await payment.connect(payer1).processPayment(paymentId, itemId, itemType, memberID, { value: amount });
    });

    it("Should return payment details", async function () {
      const paymentRecord = await payment.getPayment("PAY001");
      
      expect(paymentRecord.itemId).to.equal("ITEM001");
      expect(paymentRecord.itemType).to.equal("bill");
      expect(paymentRecord.payer).to.equal(payer1.address);
      expect(paymentRecord.amount).to.equal(ethers.parseEther("0.1"));
      expect(paymentRecord.completed).to.equal(true);
    });

    it("Should return empty payment for non-existent ID", async function () {
      const paymentRecord = await payment.getPayment("NONEXISTENT");
      
      expect(paymentRecord.itemId).to.equal("");
      expect(paymentRecord.payer).to.equal(ethers.ZeroAddress);
      expect(paymentRecord.amount).to.equal(0);
      expect(paymentRecord.completed).to.equal(false);
    });
  });

  describe("Is Item Paid", function () {
    it("Should return false for unpaid item", async function () {
      expect(await payment.isItemPaid("ITEM001")).to.equal(false);
    });

    it("Should return true for paid item", async function () {
      const paymentId = "PAY001";
      const itemId = "ITEM001";
      const itemType = "bill";
      const memberID = "MEM123456";
      const amount = ethers.parseEther("0.1");

      await payment.connect(payer1).processPayment(paymentId, itemId, itemType, memberID, { value: amount });

      expect(await payment.isItemPaid(itemId)).to.equal(true);
    });
  });

  describe("Get User Payments", function () {
    it("Should return empty array for user with no payments", async function () {
      const userPayments = await payment.getUserPayments(payer1.address);
      expect(userPayments.length).to.equal(0);
    });

    it("Should return all payments for user", async function () {
      const payments = [
        { paymentId: "PAY001", itemId: "ITEM001", itemType: "bill", memberID: "MEM123456", amount: ethers.parseEther("0.1") },
        { paymentId: "PAY002", itemId: "ITEM002", itemType: "prescription", memberID: "MEM123456", amount: ethers.parseEther("0.05") },
        { paymentId: "PAY003", itemId: "ITEM003", itemType: "consultation", memberID: "MEM123456", amount: ethers.parseEther("0.2") }
      ];

      for (const p of payments) {
        await payment.connect(payer1).processPayment(p.paymentId, p.itemId, p.itemType, p.memberID, { value: p.amount });
      }

      const userPayments = await payment.getUserPayments(payer1.address);
      expect(userPayments.length).to.equal(3);
      expect(userPayments[0]).to.equal("PAY001");
      expect(userPayments[1]).to.equal("PAY002");
      expect(userPayments[2]).to.equal("PAY003");
    });

    it("Should return payments only for specific user", async function () {
      await payment.connect(payer1).processPayment("PAY001", "ITEM001", "bill", "MEM123456", { value: ethers.parseEther("0.1") });
      await payment.connect(payer2).processPayment("PAY002", "ITEM002", "bill", "MEM789012", { value: ethers.parseEther("0.1") });

      const user1Payments = await payment.getUserPayments(payer1.address);
      const user2Payments = await payment.getUserPayments(payer2.address);

      expect(user1Payments.length).to.equal(1);
      expect(user1Payments[0]).to.equal("PAY001");

      expect(user2Payments.length).to.equal(1);
      expect(user2Payments[0]).to.equal("PAY002");
    });
  });

  describe("Get Stats", function () {
    it("Should return correct initial stats", async function () {
      const stats = await payment.getStats();
      
      expect(stats[0]).to.equal(0); // totalPaymentsProcessed
      expect(stats[1]).to.equal(0); // totalAmountProcessed
      expect(stats[2]).to.equal(0); // contract balance
    });

    it("Should return correct stats after payments", async function () {
      const amount1 = ethers.parseEther("0.1");
      const amount2 = ethers.parseEther("0.2");

      await payment.connect(payer1).processPayment("PAY001", "ITEM001", "bill", "MEM123456", { value: amount1 });
      await payment.connect(payer2).processPayment("PAY002", "ITEM002", "prescription", "MEM789012", { value: amount2 });

      const stats = await payment.getStats();
      
      expect(stats[0]).to.equal(2); // totalPaymentsProcessed
      expect(stats[1]).to.equal(amount1 + amount2); // totalAmountProcessed
      expect(stats[2]).to.equal(amount1 + amount2); // contract balance
    });
  });

  describe("Withdraw", function () {
    beforeEach(async function () {
      // Add some funds to contract
      const amount1 = ethers.parseEther("0.5");
      const amount2 = ethers.parseEther("0.3");

      await payment.connect(payer1).processPayment("PAY001", "ITEM001", "bill", "MEM123456", { value: amount1 });
      await payment.connect(payer2).processPayment("PAY002", "ITEM002", "prescription", "MEM789012", { value: amount2 });
    });

    it("Should allow owner to withdraw funds", async function () {
      const withdrawAmount = ethers.parseEther("0.5");
      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);

      const tx = await payment.connect(owner).withdraw(withdrawAmount);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
      const expectedBalance = ownerBalanceBefore + withdrawAmount - gasUsed;

      expect(ownerBalanceAfter).to.equal(expectedBalance);
    });

    it("Should emit FundsWithdrawn event", async function () {
      const withdrawAmount = ethers.parseEther("0.5");

      await expect(payment.connect(owner).withdraw(withdrawAmount))
        .to.emit(payment, "FundsWithdrawn")
        .withArgs(owner.address, withdrawAmount);
    });

    it("Should fail if not called by owner", async function () {
      const withdrawAmount = ethers.parseEther("0.5");

      await expect(
        payment.connect(payer1).withdraw(withdrawAmount)
      ).to.be.revertedWith("Only owner can call this function");
    });

    it("Should fail if insufficient balance", async function () {
      const withdrawAmount = ethers.parseEther("10");

      await expect(
        payment.connect(owner).withdraw(withdrawAmount)
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should update contract balance after withdrawal", async function () {
      const withdrawAmount = ethers.parseEther("0.5");
      const contractBalanceBefore = await ethers.provider.getBalance(await payment.getAddress());

      await payment.connect(owner).withdraw(withdrawAmount);

      const contractBalanceAfter = await ethers.provider.getBalance(await payment.getAddress());
      expect(contractBalanceAfter).to.equal(contractBalanceBefore - withdrawAmount);
    });
  });

  describe("Receive Function", function () {
    it("Should accept direct ether transfers", async function () {
      const amount = ethers.parseEther("1");
      const contractAddress = await payment.getAddress();

      await expect(
        owner.sendTransaction({ to: contractAddress, value: amount })
      ).to.emit(payment, "PaymentReceived")
        .withArgs(owner.address, amount);

      const balance = await ethers.provider.getBalance(contractAddress);
      expect(balance).to.equal(amount);
    });
  });

  describe("Multiple Payments Scenario", function () {
    it("Should handle multiple payments correctly", async function () {
      const payments = [
        { paymentId: "PAY001", itemId: "ITEM001", itemType: "bill", memberID: "MEM001", amount: ethers.parseEther("0.1") },
        { paymentId: "PAY002", itemId: "ITEM002", itemType: "prescription", memberID: "MEM001", amount: ethers.parseEther("0.05") },
        { paymentId: "PAY003", itemId: "ITEM003", itemType: "consultation", memberID: "MEM002", amount: ethers.parseEther("0.2") },
        { paymentId: "PAY004", itemId: "ITEM004", itemType: "lab", memberID: "MEM002", amount: ethers.parseEther("0.15") },
        { paymentId: "PAY005", itemId: "ITEM005", itemType: "imaging", memberID: "MEM001", amount: ethers.parseEther("0.3") }
      ];

      let totalAmount = BigInt(0);

      for (const p of payments) {
        await payment.connect(payer1).processPayment(p.paymentId, p.itemId, p.itemType, p.memberID, { value: p.amount });
        totalAmount += p.amount;
      }

      const stats = await payment.getStats();
      expect(stats[0]).to.equal(5); // totalPaymentsProcessed
      expect(stats[1]).to.equal(totalAmount); // totalAmountProcessed

      const userPayments = await payment.getUserPayments(payer1.address);
      expect(userPayments.length).to.equal(5);

      // Verify all items are marked as paid
      for (const p of payments) {
        expect(await payment.isItemPaid(p.itemId)).to.equal(true);
      }
    });
  });

  describe("Edge Cases", function () {
    it("Should handle very small payments", async function () {
      const amount = BigInt(1); // 1 wei

      const tx = await payment.connect(payer1).processPayment(
        "PAY001",
        "ITEM001",
        "bill",
        "MEM123456",
        { value: amount }
      );

      await tx.wait();
      expect(await payment.totalAmountProcessed()).to.equal(amount);
    });

    it("Should handle large member IDs", async function () {
      const longMemberID = "MEM" + "1".repeat(100);
      const amount = ethers.parseEther("0.1");

      const tx = await payment.connect(payer1).processPayment(
        "PAY001",
        "ITEM001",
        "bill",
        longMemberID,
        { value: amount }
      );

      await tx.wait();

      const paymentRecord = await payment.getPayment("PAY001");
      expect(paymentRecord.memberID).to.equal(longMemberID);
    });

    it("Should handle special characters in IDs", async function () {
      const paymentId = "PAY-001_TEST@2025";
      const itemId = "ITEM-001_BILL#123";
      const amount = ethers.parseEther("0.1");

      const tx = await payment.connect(payer1).processPayment(
        paymentId,
        itemId,
        "bill",
        "MEM123456",
        { value: amount }
      );

      await tx.wait();

      const paymentRecord = await payment.getPayment(paymentId);
      expect(paymentRecord.itemId).to.equal(itemId);
    });
  });
});
