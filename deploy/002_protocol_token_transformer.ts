import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { ProtocolTokenWrapperTransformer__factory } from '@typechained';
import { deployThroughDeterministicFactory } from '@mean-finance/deterministic-factory/utils/deployment';
import { DeployFunction } from '@0xged/hardhat-deploy/dist/types';
import { getAdminAddress } from './utils';
import { getChainId } from 'utils/deploy';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  const chainId = await getChainId(hre);
  const admin = getAdminAddress(chainId);

  await deployThroughDeterministicFactory({
    deployer,
    name: 'ProtocolTokenWrapperTransformer',
    salt: 'MF-Protocol-Transformer-V1',
    contract: 'solidity/contracts/transformers/ProtocolTokenWrapperTransformer.sol:ProtocolTokenWrapperTransformer',
    bytecode: ProtocolTokenWrapperTransformer__factory.bytecode,
    constructorArgs: {
      types: ['address'],
      values: [admin],
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
