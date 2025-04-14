const { expect } = require("chai");
const { ethers } = require("hardhat");
describe("EncFederatedLearningContract", function () {
    let contract;
    let manager;
    let participant;
    let otherParticipant;
    let owner;

    beforeEach(async function () {
        // Getting the signers from Hardhat
        [owner, manager, participant, otherParticipant] = await ethers.getSigners();
        
        // Deploy the contract
        const EncFederatedLearningContract = await ethers.getContractFactory("EncFederatedLearningContract");
        contract = await EncFederatedLearningContract.deploy();
    });

    it("should allow manager to create a new project", async function () {
        const modelArchAddress = "modelArchIPFSAddress";
        const modelWeightAddress = "globalModelWeightIPFSAddress";
        const oneTimeFee = 1;
        const managerPK = "managerPublicKey";
        
        await expect(
            contract.connect(manager).create(modelArchAddress, modelWeightAddress, oneTimeFee, managerPK)
        )
        .to.emit(contract, 'GlobalModelUpdated')
        .withArgs(manager.address, 0, 1); // Check if the event is emitted with correct arguments

        const project = await contract.projects(0);
        
        expect(project.ModelArchIPFSAddress).to.equal(modelArchAddress);
        expect(project.GlobalWeightIPFSAddress).to.equal(modelWeightAddress);
        expect(project.oneTimeFee).to.equal(oneTimeFee);
        expect(project.active).to.equal(true);
    });

    it("should allow participant to join a project", async function () {
        const modelArchAddress = "modelArchIPFSAddress";
        const modelWeightAddress = "globalModelWeightIPFSAddress";
        const oneTimeFee = 1;
        const managerPK = "managerPublicKey";
        
        await contract.connect(manager).create(modelArchAddress, modelWeightAddress, oneTimeFee, managerPK);
    
        const feeBefore = await contract.beforeJoin(0);
        expect(feeBefore).to.equal(oneTimeFee);
    
        await contract.connect(participant).join(0, "participantPublicKey", { value: ethers.parseEther("0.1") });

        const archIPFSHash = await contract.connect(participant).participateReturn(0);
        expect(archIPFSHash).to.equal(modelArchAddress);

        const weightsIPFSHash = await contract.connect(participant).joinReturn(0);
        expect(weightsIPFSHash).to.equal(modelWeightAddress);
    });
    
    it("should allow a participant to upload local model", async function () {
        const modelArchAddress = "modelArchIPFSAddress";
        const modelWeightAddress = "globalModelWeightIPFSAddress";
        const oneTimeFee = 1;
        const managerPK = "managerPublicKey";
        
        await contract.connect(manager).create(modelArchAddress, modelWeightAddress, oneTimeFee, managerPK);
        await contract.connect(participant).join(0, "participantPublicKey", { value: ethers.parseEther("0.1") });
    
        const modelAddress = "modelIPFSAddress";
        await contract.connect(participant).local_upload(0, modelAddress);
    
        const clientIPFSHashes = await contract.connect(manager).getLocalModels(0);
        const clientAddresses = await contract.connect(manager).getTrainers(0);
        expect(clientIPFSHashes[0]).to.equal(modelAddress);
        expect(clientAddresses[0]).to.equal(participant.address);
    });
    
    it("should allow the manager to update the global model", async function () {
        const modelArchAddress = "modelArchIPFSAddress";
        const modelWeightAddress = "globalModelWeightIPFSAddress";
        const oneTimeFee = 1;
        const managerPK = "managerPublicKey";
        
        await contract.connect(manager).create(modelArchAddress, modelWeightAddress, oneTimeFee, managerPK);
        await contract.connect(participant).join(0, "participantPublicKey", { value: ethers.parseEther("0.1") });
    
        const newModelAddress = "newGlobalModelIPFSAddress";
        const incentiveFees = [10]; // Assume a fee distribution for participants
        
        await contract.connect(manager).updateGlobalModel(0, newModelAddress, incentiveFees);
    
        const project = await contract.projects(0);
        expect(project.GlobalWeightIPFSAddress).to.equal(newModelAddress);
        expect(project.iteration).to.equal(2);  // iteration should increment
    });
    
    it("should settle billings correctly", async function () {
        const modelArchAddress = "modelArchIPFSAddress";
        const modelWeightAddress = "globalModelWeightIPFSAddress";
        const oneTimeFee = 1;
        const managerPK = "managerPublicKey";
        
        await contract.connect(manager).create(modelArchAddress, modelWeightAddress, oneTimeFee, managerPK);
        await contract.connect(participant).join(0, "participantPublicKey", { value: ethers.parseEther("0.1") });
    
        await contract.connect(manager).settleBillings(0);
    
        const participantBalanceAfter = await ethers.provider.getBalance(participant.address);
        expect(participantBalanceAfter).to.be.above(0);  // Check if the participant has received some balance after settlement
    });

    // You can add more tests for other functions like buy, participateReturn, etc.
});