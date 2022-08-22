import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { bytecode } from '../artifacts/solidity/contracts/transformers/ERC4626Transformer.sol/ERC4626Transformer.json';
import { deployThroughDeterministicFactory } from '@mean-finance/deterministic-factory/utils/deployment';
import { DeployFunction } from '@0xged/hardhat-deploy/dist/types';
import * as env from '../utils/env';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, msig } = await hre.getNamedAccounts();

  await deployThroughDeterministicFactory({
    deployer,
    name: 'ERC4626Transformer',
    salt: 'MF-ERC4626-Transformer-V1',
    contract: 'solidity/contracts/transformers/ERC4626Transformer.sol:ERC4626Transformer',
    bytecode,
    constructorArgs: {
      types: ['address'],
      values: [msig],
    },
    log: !process.env.TEST,
    overrides: env.isTesting()
      ? {}
      : {
          gasLimit: 3_000_000,
        },
  });
};

deployFunction.dependencies = [];
deployFunction.tags = ['ERC4626Transformer'];
export default deployFunction;
