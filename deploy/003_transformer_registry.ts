import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { TransformerRegistry__factory } from '@typechained';
import { deployThroughDeterministicFactory } from '@mean-finance/deterministic-factory/utils/deployment';
import { DeployFunction } from '@0xged/hardhat-deploy/dist/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer, admin } = await hre.getNamedAccounts();

  await deployThroughDeterministicFactory({
    deployer,
    name: 'TransformerRegistry',
    salt: 'MF-Transformer-Registry-V1',
    contract: 'solidity/contracts/TransformerRegistry.sol:TransformerRegistry',
    bytecode: TransformerRegistry__factory.bytecode,
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
deployFunction.tags = ['TransformerRegistry'];
export default deployFunction;
