const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("EncFederatedLearningDeployment", (m) => {
  const encFederatedLearningContract = m.contract("EncFederatedLearningContract", []);
  return { encFederatedLearningContract };
});