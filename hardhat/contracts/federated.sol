// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract EncFederatedLearningContract {
    uint256 public projectIdCounter;

    constructor() payable {
        projectIdCounter = 0;
    }

    struct FLProject {
        address payable managerAddress;
        string ModelArchIPFSAddress;
        string GlobalWeightIPFSAddress;
        uint256 oneTimeFee;
        bool active;
        bool purchase;
        mapping(address => bool) isParticipants;
        address[] trainers;
        address[] participants;
        uint256 count;
        uint256 iteration;
        mapping(address => uint256) billings;
        mapping(address => string) localModelIPFSAddress;
        mapping(address => string) pkList;
        mapping(address => string) clientEncryptedKeys;
    }

    mapping(uint256 => FLProject) public projects;
    mapping(address => uint256) public projectsOwners;
    uint256 constant NON_EXISTENT = type(uint256).max;
    event LocalTrainingFinished(address indexed clientAddress, uint256 indexed projectId, uint256 indexed iteration);
    event GlobalModelUpdated(address indexed managerAddress, uint256 indexed projectId, uint256 indexed iteration);
    event AchieveKey(address indexed clientAddress, uint256 indexed projectId, uint256 indexed iteration, string clientPK);
    event EncryptedKey(address indexed clientAddress, uint256 indexed projectId, uint256 indexed iteration, string encryptedKey);

    function create(string calldata modelArchAddress, string calldata modelWeightAddress, uint256 oneTimeFee, string calldata PK) external {
        FLProject storage newProject = projects[projectIdCounter];
        projectsOwners[msg.sender] = projectIdCounter;
        newProject.managerAddress = payable(msg.sender); // Convert to address payable
        newProject.ModelArchIPFSAddress = modelArchAddress;
        newProject.GlobalWeightIPFSAddress = modelWeightAddress;
        newProject.pkList[msg.sender] = PK;

        newProject.oneTimeFee = oneTimeFee;
        newProject.active = true;
        newProject.purchase = false;

        newProject.iteration = 1;
        emit GlobalModelUpdated(msg.sender, projectIdCounter, newProject.iteration);

        projectIdCounter = projectIdCounter + 1;
    }

    function createReturn() external view returns (uint256) {
        require(projectsOwners[msg.sender] != NON_EXISTENT, "Not exist");
        return projectsOwners[msg.sender];
    }

    function getMainPK(uint256 projectId) external view returns (string memory) {
        require(projectIdCounter > projectId, "Project does not exist");
        FLProject storage project = projects[projectId];
        return project.pkList[project.managerAddress];
    }

    function beforeJoin(uint256 projectId) external view returns (uint256) {
        require(projectIdCounter > projectId, "Project does not exist");
        FLProject storage project = projects[projectId];
        uint256 fee = project.oneTimeFee;
        if (project.isParticipants[msg.sender]) {
            if (project.oneTimeFee <= project.billings[msg.sender]) {
                fee = 0;
            } else {
                fee -= project.billings[msg.sender];
            }
        }
        return project.oneTimeFee;
    }

    function join(uint256 projectId, string calldata PK) external payable {
        require(projectIdCounter > projectId, "Project does not exist");
        require(!isTrainer(msg.sender, projectId), "Has already joined");
        FLProject storage project = projects[projectId];
        require(project.active, "Project is not active");

        if (!project.isParticipants[msg.sender]) {
            // Pay the fee to the project owner for the first join
            require(msg.value / (0.1 ether) >= project.oneTimeFee, "Insufficient fee A.");
            project.managerAddress.transfer(msg.value);
            project.isParticipants[msg.sender] = true;
            project.billings[msg.sender] = msg.value / (0.1 ether);
            project.participants.push(msg.sender);
            project.pkList[msg.sender] = PK;
        } else {
            if (project.oneTimeFee > project.billings[msg.sender]) {
                uint256 fee = project.oneTimeFee - project.billings[msg.sender];
                require(msg.value >= fee * 0.1 ether, "Insufficient fee B.");
                project.managerAddress.transfer(msg.value);
                project.billings[msg.sender] += msg.value / (0.1 ether);
            }
        }
        project.trainers.push(msg.sender);
        project.count++;
        emit AchieveKey(msg.sender, projectId, project.iteration, PK);
    }


    function buy(uint256 projectId, string calldata PK) external payable {
        require(projectIdCounter > projectId, "Project does not exist");
        FLProject storage project = projects[projectId];
        require(!project.active, "Project is still in training");
        require(project.purchase, "Project is not purchasable");

        if (!project.isParticipants[msg.sender]) {
            // Pay the fee to the project owner for the first join
            require(msg.value >= project.oneTimeFee * 0.1 ether, "Insufficient fee");
            project.managerAddress.transfer(msg.value);
            project.isParticipants[msg.sender] = true;
            project.billings[msg.sender] = msg.value / (0.1 ether);
            project.participants.push(msg.sender);
            project.pkList[msg.sender] = PK;
        } else {
            if (project.oneTimeFee > project.billings[msg.sender]) {
                uint256 fee = project.oneTimeFee - project.billings[msg.sender];
                require(msg.value >= fee * 0.1 ether, "Insufficient fee");
                project.managerAddress.transfer(msg.value);
                project.billings[msg.sender] += msg.value / (0.1 ether);
            }
        }
        project.trainers.push(msg.sender);
        project.count++;
        emit AchieveKey(msg.sender, projectId, project.iteration, PK);
    }


    function participateReturn(uint256 projectId) external view returns (string memory) {
        require(projectIdCounter > projectId, "Project does not exist");
        FLProject storage project = projects[projectId];
        require(project.isParticipants[msg.sender], "Not participate"); //
        return project.ModelArchIPFSAddress;
    }

    function joinReturn(uint256 projectId) external view returns (string memory) {
        require(projectIdCounter > projectId, "Project does not exist");
        require(isTrainer(msg.sender, projectId), "Not joined this iteration");
        FLProject storage project = projects[projectId];
        return project.GlobalWeightIPFSAddress;
    }

    function modelweightReturn(uint256 projectId) external view returns (string memory) {
        require(projectIdCounter > projectId, "Project does not exist");
        FLProject storage project = projects[projectId];
        require(project.isParticipants[msg.sender], "Not participate"); 
        return project.GlobalWeightIPFSAddress;
    }
    

    function viewGlobalModel(uint256 projectId) external view returns (string memory) {
        require(projectIdCounter > projectId, "Project does not exist");
        require(isTrainer(msg.sender, projectId), "Has not joined");
        FLProject storage project = projects[projectId];
        return project.GlobalWeightIPFSAddress;
    }

    function local_upload(uint256 projectId, string calldata modelAddress) external {
        require(projectIdCounter > projectId, "Project does not exist");
        FLProject storage project = projects[projectId];
        require(project.active, "Project is not active");
        require(isTrainer(msg.sender, projectId), "Has not joined");
        project.localModelIPFSAddress[msg.sender] = modelAddress;
        project.count--;
        if(project.count==0){
            project.active = false;
            emit LocalTrainingFinished(msg.sender, projectId, project.iteration);
        }
    }

    function getLocalModels(uint256 projectId) external view returns (string[] memory){
        require(projectIdCounter > projectId, "Project does not exist");
        FLProject storage project = projects[projectId];
        require(project.managerAddress==msg.sender, "Only FL manager can do");
        require(!project.active, "This iteration is still in training");

        uint256 numTrainers = project.trainers.length;
        require(numTrainers > 0, "No participants in the FL process");

        // Sum up the local models of all participants
        string[] memory modelAddressesList = new string[](numTrainers);

        for (uint256 i = 0; i < numTrainers; i++) {
            address participantAddress = project.trainers[i];
            modelAddressesList[i] = project.localModelIPFSAddress[participantAddress];
        }
        // project.upload = true;
        return modelAddressesList;
    }

    function getTrainers(uint256 projectId) external view returns (address[] memory){
        require(projectIdCounter > projectId, "Project does not exist");
        FLProject storage project = projects[projectId];
        require(project.managerAddress==msg.sender, "Only FL manager can do");
        require(!project.active, "This iteration is still in training");

        uint256 numTrainers = project.trainers.length;
        require(numTrainers > 0, "No participants in the FL process");

        // project.upload = true;
        return project.trainers;
    }

    function updateGlobalModel(uint256 projectId, string calldata modelAddress, uint256[] memory incentiveFees) external {
        require(projectIdCounter > projectId, "Project does not exist");
        FLProject storage project = projects[projectId];
        require(project.managerAddress==msg.sender, "Only FL manager can do");
        // require(project.upload, "Please first get the local models");

        project.GlobalWeightIPFSAddress = modelAddress;

        project.iteration += 1;

        distributeIncentiveFee(projectId, incentiveFees);

        //reset process
        uint256 numTrainers = project.trainers.length;
        for (uint256 i = 0; i < numTrainers; i++) {
            delete project.trainers[i];
        }
        project.trainers = new address[](0);
    }

    function updateEncryptedKey(uint256 projectId, address clientAddress, string calldata encryptedKey) external {
        require(projectIdCounter > projectId, "Project does not exist");
        FLProject storage project = projects[projectId];
        require(project.managerAddress==msg.sender, "Only FL manager can do");
        project.clientEncryptedKeys[clientAddress] = encryptedKey;
        emit EncryptedKey(clientAddress, projectId, project.iteration, encryptedKey);
    }

    function whetherContinue(uint256 projectId, bool flag) external {
        require(projectIdCounter > projectId, "Project does not exist");
        FLProject storage project = projects[projectId];
        require(project.managerAddress==msg.sender, "Only FL manager can do");

        if(flag) {
            project.active = true;
            emit GlobalModelUpdated(msg.sender, projectId, project.iteration);
        } else {
            project.purchase = true;
        }
    }

    // Function to distribute incentive fee to participants
    function distributeIncentiveFee(uint256 projectId, uint256[] memory incentiveFees) private {
        require(projectIdCounter > projectId, "Project does not exist");
        FLProject storage project = projects[projectId];

        uint256 numTrainers = project.trainers.length;

        for (uint256 i = 0; i < numTrainers; i++) {
            address participantAddress = project.trainers[i];
            project.billings[participantAddress] += incentiveFees[i];
        }
    }

    function billingsReturn(uint256 projectId) external view returns (uint256 totalBilling) {
        require(projectIdCounter > projectId, "Project does not exist");
        FLProject storage project = projects[projectId];
        require(!project.active, "This iteration is still in training");

        uint256 total = 0;
        uint256 numParticipants = project.participants.length;
        for (uint256 i = 0; i < numParticipants; i++) {
            address participantAddress = project.participants[i];
            total += project.billings[participantAddress] - project.oneTimeFee;
        }
        return total;
    }

    function settleBillings(uint256 projectId) external payable  {
        require(projectIdCounter > projectId, "Project does not exist");
        FLProject storage project = projects[projectId];
        require(project.managerAddress==msg.sender, "Only FL manager can do");
        
        uint256 numParticipants = project.participants.length;
        for (uint256 i = 0; i < numParticipants; i++) {
            address participantAddress = project.participants[i];
            uint256 incentiveFee = project.billings[participantAddress] - project.oneTimeFee;
            project.billings[participantAddress] -= project.oneTimeFee;
            payable(participantAddress).transfer(incentiveFee * 0.1 ether);
        }
    }

    function isTrainer(address clientAddress, uint256 projectId) private view returns (bool) {
        require(projectIdCounter > projectId, "Project does not exist");
        FLProject storage project = projects[projectId];
        uint256 numParticipants = project.trainers.length;

        for (uint256 i = 0; i < numParticipants; i++) {
            if(clientAddress == project.trainers[i]){
                return true;
            }
        }
        return false;
    }

    function isTrainable(uint256 projectId) external view returns (bool) {
        require(projectIdCounter > projectId, "Project does not exist");
        FLProject storage project = projects[projectId];
        return project.active;
    }

    function isPurchasable(uint256 projectId) external view returns (bool) {
        require(projectIdCounter > projectId, "Project does not exist");
        FLProject storage project = projects[projectId];
        return project.purchase;
    }
}