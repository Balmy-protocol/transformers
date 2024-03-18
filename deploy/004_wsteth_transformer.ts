import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { bytecode } from '../artifacts/solidity/contracts/transformers/wstETHTransformer.sol/wstETHTransformer.json';
import { deployThroughDeterministicFactory } from '@mean-finance/deterministic-factory/utils/deployment';
import { DeployFunction } from '@0xged/hardhat-deploy/dist/types';

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  let stETH: string | undefined;
  switch (hre.deployments.getNetworkName().toLowerCase()) {
    case 'ethereum':
      stETH = '0xae7ab96520de3a18e5e111b5eaab095312d7fe84';
      break;
  }

  if (!stETH) return;

  await deployThroughDeterministicFactory({
    deployer,
    name: 'wstETHTransformer',
    salt: 'MF-wstETH-Transformer-V1',
    contract: 'solidity/contracts/transformers/wstETHTransformer.sol:wstETHTransformer',
    bytecode,
    constructorArgs: {
      types: ['address'],
      values: [stETH],
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
deployFunction.tags = ['wstETHTransformer'];
export default deployFunction;
