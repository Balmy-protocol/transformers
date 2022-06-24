import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { given, then, when } from '@utils/bdd';
import { ERC4626Transformer, ERC4626Transformer__factory, IERC4626, ITransformer } from '@typechained';
import { snapshot } from '@utils/evm';
import { smock, FakeContract } from '@defi-wonderland/smock';
import { BigNumber } from 'ethers';

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
    vault.previewDeposit.reset();
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
      then('undelying amount is returned correctly', async () => {
        expect(underlying.length).to.equal(1);
        expect(underlying[0].amount).to.equal(AMOUNT_UNDERLYING);
        expect(underlying[0].underlying).to.equal(UNDERLYING);
      });
    });
  });

  describe('calculateTransformToDependent', () => {
    when('function is called', () => {
      let amountDependent: BigNumber;
      given(async () => {
        vault.previewDeposit.returns(AMOUNT_DEPENDENT);
        amountDependent = await transformer.calculateTransformToDependent(vault.address, [
          { underlying: UNDERLYING, amount: AMOUNT_UNDERLYING },
        ]);
      });
      then('vault is called correctly', () => {
        expect(vault.previewDeposit).to.have.been.calledOnceWith(AMOUNT_UNDERLYING);
      });
      then('dependent amount is returned correctly', async () => {
        expect(amountDependent).to.equal(AMOUNT_DEPENDENT);
      });
    });
  });
});
