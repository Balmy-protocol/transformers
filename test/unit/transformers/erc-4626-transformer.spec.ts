import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { given, then, when } from '@utils/bdd';
import { ERC4626Transformer, ERC4626Transformer__factory, IERC4626, ITransformer } from '@typechained';
import { snapshot } from '@utils/evm';
import { smock, FakeContract } from '@defi-wonderland/smock';

chai.use(smock.matchers);

describe('ERC4626Transformer', () => {
  const UNDERLYING = '0x0000000000000000000000000000000000000001';
  const AMOUNT_DEPENDENT = 100000;
  const AMOUNT_UNDERLYING = 12345678;

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
    vault.previewRedeem.reset();
  });

  describe('getUnderlying', () => {
    when('function is called', () => {
      then('underlying token is returned correctly', async () => {
        const underlying = await transformer.getUnderlying(vault.address);
        expect(underlying).to.eql([UNDERLYING]);
      });
    });
  });

  describe('calculateTransformToUnderlying', () => {
    when('function is called', () => {
      let underlying: ITransformer.UnderlyingAmountStructOutput[];
      given(async () => {
        vault.previewRedeem.returns(AMOUNT_UNDERLYING);
        underlying = await transformer.calculateTransformToUnderlying(vault.address, AMOUNT_DEPENDENT);
      });
      then('vault is called correctly', () => {
        expect(vault.previewRedeem).to.have.been.calledOnceWith(AMOUNT_DEPENDENT);
      });
      then('undelying amount is called correctly', async () => {
        expect(underlying.length).to.equal(1);
        expect(underlying[0].amount).to.equal(AMOUNT_UNDERLYING);
        expect(underlying[0].underlying).to.equal(UNDERLYING);
      });
    });
  });
});
