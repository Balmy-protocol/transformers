import { ERC20Mock, ERC20Mock__factory } from '@typechained';
import { ethers } from 'hardhat';

export const deploy = async ({ name, symbol }: { name: string; symbol: string }): Promise<ERC20Mock> => {
  const factory: ERC20Mock__factory = await ethers.getContractFactory('solidity/contracts/test/ERC20.sol:ERC20Mock');
  return factory.deploy(name, symbol);
};
