import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { bytecode } from '../artifacts/solidity/contracts/transformers/ERC4626Transformer.sol/ERC4626Transformer.json';
import { deployThroughDeterministicFactory } from '@mean-finance/deterministic-factory/utils/deployment';
import { DeployFunction } from '@0xged/hardhat-deploy/dist/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  await deployThroughDeterministicFactory({
    deployer,
    name: 'ERC4626Transformer',
    salt: 'MF-ERC4626-Transformer-V1',
    contract: 'solidity/contracts/transformers/ERC4626Transformer.sol:ERC4626Transformer',
    bytecode,
    constructorArgs: {
      types: [],
      values: [],
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
deployFunction.tags = ['ERC4626Transformer'];
export default deployFunction;
