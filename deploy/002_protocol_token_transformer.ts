import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { bytecode } from '../artifacts/solidity/contracts/transformers/ProtocolTokenWrapperTransformer.sol/ProtocolTokenWrapperTransformer.json';
import { deployThroughDeterministicFactory } from '@mean-finance/deterministic-factory/utils/deployment';
import { DeployFunction } from '@0xged/hardhat-deploy/dist/types';
import * as env from '../utils/env';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, msig } = await hre.getNamedAccounts();

  await deployThroughDeterministicFactory({
    deployer,
    name: 'ProtocolTokenWrapperTransformer',
    salt: 'MF-Protocol-Transformer-V1',
    contract: 'solidity/contracts/transformers/ProtocolTokenWrapperTransformer.sol:ProtocolTokenWrapperTransformer',
    bytecode,
    constructorArgs: {
      types: ['address'],
      values: [msig],
    },
    log: !process.env.TEST,
    overrides: !!process.env.TEST
      ? {}
      : {
          gasLimit: 3_000_000,
        },
  });
};

deployFunction.dependencies = [];
deployFunction.tags = ['ProtocolTokenWrapperTransformer'];
export default deployFunction;
