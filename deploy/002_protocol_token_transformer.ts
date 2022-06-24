import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { getCreationCode } from '@utils/contracts';
import { ethers } from 'hardhat';
import { utils } from 'ethers';
import { ProtocolTokenWrapperTransformer__factory } from '@typechained';
import { DeterministicFactory, DeterministicFactory__factory } from '@mean-finance/deterministic-factory/typechained';
import { DeployFunction } from '@0xged/hardhat-deploy/dist/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  const deterministicFactory = await ethers.getContractAt<DeterministicFactory>(
    DeterministicFactory__factory.abi,
    '0xbb681d77506df5CA21D2214ab3923b4C056aa3e2'
  );

  const SALT = utils.formatBytes32String('MF-Protocol-Transformer-V1');

  const creationCode = getCreationCode({
    bytecode: ProtocolTokenWrapperTransformer__factory.bytecode,
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
    name: 'ProtocolTokenWrapperTransformer',
    contractAddress: await deterministicFactory.getDeployed(SALT),
    options: {
      contract: 'solidity/contracts/transformers/ProtocolTokenWrapperTransformer.sol:ProtocolTokenWrapperTransformer',
      from: deployer,
      args: [],
    },
    receipt,
  });

  await hre.deployments.save('ProtocolTokenWrapperTransformer', deployment);
};

deployFunction.dependencies = [];
deployFunction.tags = ['ProtocolTokenWrapperTransformer'];
export default deployFunction;
