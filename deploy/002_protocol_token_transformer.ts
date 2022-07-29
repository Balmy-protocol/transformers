import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { ProtocolTokenWrapperTransformer__factory } from '@typechained';
import { deployThroughDeterministicFactory } from '@mean-finance/deterministic-factory/utils/deployment';
import { DeployFunction } from '@0xged/hardhat-deploy/dist/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, governor } = await hre.getNamedAccounts();

  await deployThroughDeterministicFactory({
    deployer,
    name: 'ProtocolTokenWrapperTransformer',
    salt: 'MF-Protocol-Transformer-V1',
    contract: 'solidity/contracts/transformers/ProtocolTokenWrapperTransformer.sol:ProtocolTokenWrapperTransformer',
    bytecode: ProtocolTokenWrapperTransformer__factory.bytecode,
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
deployFunction.tags = ['ProtocolTokenWrapperTransformer'];
export default deployFunction;
