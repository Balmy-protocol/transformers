import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { then, when } from '@utils/bdd';
import { ERC4626Transformer, ERC4626Transformer__factory, IERC4626 } from '@typechained';
import { snapshot } from '@utils/evm';
import { smock, FakeContract } from '@defi-wonderland/smock';

chai.use(smock.matchers);

describe('ERC4626Transformer', () => {
  const UNDERLYING = '0x0000000000000000000000000000000000000001';

  let transformer: ERC4626Transformer;
  let vault: FakeContract<IERC4626>;
  let snapshotId: string;

  before('Setup accounts and contracts', async () => {
    vault = await smock.fake('IERC4626');
    vault.asset.returns(UNDERLYING);
    const adapterFactory: ERC4626Transformer__factory = await ethers.getContractFactory(
      'solidity/contracts/transformers/ERC4626Transformer.sol:ERC4626Transformer'
    );
    transformer = await adapterFactory.deploy();
    snapshotId = await snapshot.take();
  });

  beforeEach(async () => {
    await snapshot.revert(snapshotId);
  });

  describe('getUnderlying', () => {
    when('function is called', () => {
      then('underlying token is returned correctly', async () => {
        const underlying = await transformer.getUnderlying(vault.address);
        expect(underlying).to.eql([UNDERLYING]);
      });
    });
  });
});
