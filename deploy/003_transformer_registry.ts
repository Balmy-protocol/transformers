import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { bytecode } from '../artifacts/solidity/contracts/TransformerRegistry.sol/TransformerRegistry.json';
import { deployThroughDeterministicFactory } from '@mean-finance/deterministic-factory/utils/deployment';
import { DeployFunction } from '@0xged/hardhat-deploy/dist/types';
import * as env from '../utils/env';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, msig } = await hre.getNamedAccounts();

  await deployThroughDeterministicFactory({
    deployer,
    name: 'TransformerRegistry',
    salt: 'MF-Transformer-Registry-V1',
    contract: 'solidity/contracts/TransformerRegistry.sol:TransformerRegistry',
    bytecode,
    constructorArgs: {
      types: ['address'],
      values: [msig],
    },
    log: !process.env.TEST,
    overrides: !!process.env.COVERAGE
      ? {}
      : {
          gasLimit: 3_000_000,
        },
  });
};

deployFunction.dependencies = [];
deployFunction.tags = ['TransformerRegistry'];
export default deployFunction;
