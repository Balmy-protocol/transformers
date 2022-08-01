import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { bytecode } from '../artifacts/solidity/contracts/TransformerRegistry.sol/TransformerRegistry.json';
import { deployThroughDeterministicFactory } from '@mean-finance/deterministic-factory/utils/deployment';
import { DeployFunction } from '@0xged/hardhat-deploy/dist/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  await deployThroughDeterministicFactory({
    deployer,
    name: 'TransformerRegistry',
    salt: 'MF-Transformer-Registry-V1',
    contract: 'solidity/contracts/TransformerRegistry.sol:TransformerRegistry',
    bytecode,
    constructorArgs: {
      types: ['address'],
      values: [governor],
    },
    log: !process.env.TEST,
    overrides: {
      gasLimit: 3_000_000,
    },
  });
};

deployFunction.dependencies = [];
deployFunction.tags = ['TransformerRegistry'];
export default deployFunction;
