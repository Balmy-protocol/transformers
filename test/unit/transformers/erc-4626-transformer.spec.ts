import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { given, then, when } from '@utils/bdd';
import { ERC4626Transformer, ERC4626Transformer__factory, IERC20, IERC4626, ITransformer } from '@typechained';
import { snapshot } from '@utils/evm';
import { smock, FakeContract } from '@defi-wonderland/smock';
import { BigNumber } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

chai.use(smock.matchers);

describe('ERC4626Transformer', () => {
  const AMOUNT_DEPENDENT = 100000;
  const AMOUNT_UNDERLYING = 12345678;

  let signer: SignerWithAddress, recipient: SignerWithAddress;
  let transformer: ERC4626Transformer;
  let underlyingToken: FakeContract<IERC20>;
  let vault: FakeContract<IERC4626>;
  let snapshotId: string;

  before('Setup accounts and contracts', async () => {
    [signer, recipient] = await ethers.getSigners();
    underlyingToken = await smock.fake('IERC20');
    vault = await smock.fake('IERC4626');
    vault.asset.returns(underlyingToken.address);
    const factory: ERC4626Transformer__factory = await ethers.getContractFactory(
      'solidity/contracts/transformers/ERC4626Transformer.sol:ERC4626Transformer'
    );
    transformer = await factory.deploy(signer.address);
    snapshotId = await snapshot.take();
  });

  beforeEach(async () => {
    await snapshot.revert(snapshotId);
    vault.previewRedeem.reset();
    vault.previewDeposit.reset();
    vault.redeem.reset();
    vault.deposit.reset();
    underlyingToken.transferFrom.reset();
    underlyingToken.approve.reset();
    underlyingToken.transferFrom.returns(true);
  });

  describe('getUnderlying', () => {
    when('function is called', () => {
      then('underlying token is returned correctly', async () => {
        const underlying = await transformer.getUnderlying(vault.address);
        expect(underlying).to.eql([underlyingToken.address]);
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
      then('underlying amount is returned correctly', async () => {
        expect(underlying.length).to.equal(1);
        expect(underlying[0].amount).to.equal(AMOUNT_UNDERLYING);
        expect(underlying[0].underlying).to.equal(underlyingToken.address);
      });
    });
  });

  describe('calculateTransformToDependent', () => {
    when('function is called', () => {
      let amountDependent: BigNumber;
      given(async () => {
        vault.previewDeposit.returns(AMOUNT_DEPENDENT);
        amountDependent = await transformer.calculateTransformToDependent(vault.address, [
          { underlying: underlyingToken.address, amount: AMOUNT_UNDERLYING },
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

  describe('transformToUnderlying', () => {
    when('function is called', () => {
      given(async () => {
        vault.redeem.returns(AMOUNT_UNDERLYING);
        await transformer.transformToUnderlying(vault.address, AMOUNT_DEPENDENT, recipient.address);
      });
      then('vault is called correctly', () => {
        expect(vault.redeem).to.have.been.calledOnceWith(AMOUNT_DEPENDENT, recipient.address, signer.address);
      });
      then('underlying amount is returned correctly', async () => {
        const underlying = await transformer.callStatic.transformToUnderlying(vault.address, AMOUNT_DEPENDENT, recipient.address);
        expect(underlying.length).to.equal(1);
        expect(underlying[0].amount).to.equal(AMOUNT_UNDERLYING);
        expect(underlying[0].underlying).to.equal(underlyingToken.address);
      });
    });
  });

  describe('transformToDependent', () => {
    when('function is called', () => {
      given(async () => {
        vault.deposit.returns(AMOUNT_DEPENDENT);
        await transformer.transformToDependent(
          vault.address,
          [{ underlying: underlyingToken.address, amount: AMOUNT_UNDERLYING }],
          recipient.address
        );
      });
      then('underlying token is taken from caller', () => {
        expect(underlyingToken.transferFrom).to.have.been.calledOnceWith(signer.address, transformer.address, AMOUNT_UNDERLYING);
      });
      then('underlying token is approved for vault', () => {
        expect(underlyingToken.approve).to.have.been.calledOnceWith(vault.address, AMOUNT_UNDERLYING);
      });
      then('vault is called correctly', () => {
        expect(vault.deposit).to.have.been.calledOnceWith(AMOUNT_UNDERLYING, recipient.address);
      });
      then('dependent amount is returned correctly', async () => {
        const amountDependent = await transformer.callStatic.transformToDependent(
          vault.address,
          [{ underlying: underlyingToken.address, amount: AMOUNT_UNDERLYING }],
          recipient.address
        );
        expect(amountDependent).to.equal(AMOUNT_DEPENDENT);
      });
    });
  });
});
