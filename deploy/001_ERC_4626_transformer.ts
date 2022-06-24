import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getCreationCode } from '@utils/contracts';
import { ethers } from 'hardhat';
import { utils } from 'ethers';
import { ERC4626Transformer__factory } from '@typechained';
import { DeterministicFactory, DeterministicFactory__factory } from '@mean-finance/deterministic-factory/typechained';
import { DeployFunction } from '@0xged/hardhat-deploy/dist/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  const deterministicFactory = await ethers.getContractAt<DeterministicFactory>(
    DeterministicFactory__factory.abi,
    '0xbb681d77506df5CA21D2214ab3923b4C056aa3e2'
  );

  const SALT = utils.formatBytes32String('MF-ERC4626-Transformer-V1');

  const creationCode = getCreationCode({
    bytecode: ERC4626Transformer__factory.bytecode,
    constructorArgs: {
      types: [],
      values: [],
    },
  });

  const deploymentTx = await deterministicFactory.deploy(
    SALT, // SALT
    creationCode,
    0 // Value
  );

  const receipt = await deploymentTx.wait();

  const deployment = await hre.deployments.buildDeploymentSubmission({
    name: 'ERC4626Transformer',
    contractAddress: await deterministicFactory.getDeployed(SALT),
    options: {
      contract: 'solidity/contracts/transformers/ERC4626Transformer.sol:ERC4626Transformer',
      from: deployer,
      args: [],
    },
    receipt,
  });

  await hre.deployments.save('ERC4626Transformer', deployment);
};

deployFunction.dependencies = [];
deployFunction.tags = ['ERC4626Transformer'];
export default deployFunction;
