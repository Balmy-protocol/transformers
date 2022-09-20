import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { given, then, when } from '@utils/bdd';
import { ERC4626Transformer, ERC4626Transformer__factory, IERC20, IERC4626, ITransformer } from '@typechained';
import { snapshot } from '@utils/evm';
import { smock, FakeContract } from '@defi-wonderland/smock';
import { BigNumber, constants } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { behaviours } from '@utils';

chai.use(smock.matchers);

describe('ERC4626Transformer', () => {
  const AMOUNT_DEPENDENT = 100000;
  const AMOUNT_UNDERLYING = 12345678;
  const DEADLINE = constants.MaxInt256;

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
    vault.previewMint.reset();
    vault.redeem.reset();
    vault.deposit.reset();
    vault.mint.reset();
    vault.withdraw.reset();
    underlyingToken.transferFrom.reset();
    underlyingToken.approve.reset();
    underlyingToken.transfer.reset();
    underlyingToken.transferFrom.returns(true);
    underlyingToken.transfer.returns(true);
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
    invalidUnderlyingInputTest({
      func: 'calculateTransformToDependent',
      input: (underlying) => [vault.address, underlying],
    });
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

  describe('calculateNeededToTransformToUnderlying', () => {
    invalidUnderlyingInputTest({
      func: 'calculateNeededToTransformToUnderlying',
      input: (underlying) => [vault.address, underlying],
    });
    when('function is called', () => {
      let neededDependent: BigNumber;
      given(async () => {
        vault.previewWithdraw.returns(AMOUNT_DEPENDENT);
        neededDependent = await transformer.calculateNeededToTransformToUnderlying(vault.address, [
          { underlying: underlyingToken.address, amount: AMOUNT_UNDERLYING },
        ]);
      });
      then('vault is called correctly', () => {
        expect(vault.previewWithdraw).to.have.been.calledOnceWith(AMOUNT_UNDERLYING);
      });
      then('needed dependent is returned correctly', async () => {
        expect(neededDependent).to.equal(AMOUNT_DEPENDENT);
      });
    });
  });

  describe('calculateNeededToTransformToDependent', () => {
    when('function is called', () => {
      let neededUnderlying: ITransformer.UnderlyingAmountStructOutput[];
      given(async () => {
        vault.previewMint.returns(AMOUNT_UNDERLYING);
        neededUnderlying = await transformer.calculateNeededToTransformToDependent(vault.address, AMOUNT_DEPENDENT);
      });
      then('vault is called correctly', () => {
        expect(vault.previewMint).to.have.been.calledOnceWith(AMOUNT_DEPENDENT);
      });
      then('needed underlying is returned correctly', async () => {
        expect(neededUnderlying.length).to.equal(1);
        expect(neededUnderlying[0].amount).to.equal(AMOUNT_UNDERLYING);
        expect(neededUnderlying[0].underlying).to.equal(underlyingToken.address);
      });
    });
  });

  describe('transformToUnderlying', () => {
    given(() => {
      vault.redeem.returns(AMOUNT_UNDERLYING);
    });
    invalidUnderlyingInputTest({
      func: 'transformToUnderlying',
      input: (underlying) => [vault.address, AMOUNT_DEPENDENT, recipient.address, underlying, DEADLINE],
    });
    when('asking for more than received', () => {
      then('tx reverts with message', async () => {
        await behaviours.txShouldRevertWithMessage({
          contract: transformer,
          func: 'transformToUnderlying',
          args: [
            vault.address,
            AMOUNT_DEPENDENT,
            recipient.address,
            [{ underlying: underlyingToken.address, amount: AMOUNT_UNDERLYING + 1 }],
            DEADLINE,
          ],
          message: `ReceivedLessThanExpected(${AMOUNT_UNDERLYING})`,
        });
      });
    });
    when('function is called', () => {
      given(async () => {
        await transformer.transformToUnderlying(
          vault.address,
          AMOUNT_DEPENDENT,
          recipient.address,
          [{ underlying: underlyingToken.address, amount: AMOUNT_UNDERLYING }],
          DEADLINE
        );
      });
      then('vault is called correctly', () => {
        expect(vault.redeem).to.have.been.calledOnceWith(AMOUNT_DEPENDENT, recipient.address, signer.address);
      });
      then('underlying amount is returned correctly', async () => {
        const underlying = await transformer.callStatic.transformToUnderlying(
          vault.address,
          AMOUNT_DEPENDENT,
          recipient.address,
          [{ underlying: underlyingToken.address, amount: AMOUNT_UNDERLYING }],
          DEADLINE
        );
        expect(underlying.length).to.equal(1);
        expect(underlying[0].amount).to.equal(AMOUNT_UNDERLYING);
        expect(underlying[0].underlying).to.equal(underlyingToken.address);
      });
    });
  });

  describe('transformToDependent', () => {
    given(() => {
      vault.deposit.returns(AMOUNT_DEPENDENT);
    });
    invalidUnderlyingInputTest({
      func: 'transformToDependent',
      input: (underlying) => [vault.address, underlying, recipient.address, AMOUNT_DEPENDENT, DEADLINE],
    });
    when('asking for more than received', () => {
      then('tx reverts with message', async () => {
        await behaviours.txShouldRevertWithMessage({
          contract: transformer,
          func: 'transformToDependent',
          args: [
            vault.address,
            [{ underlying: underlyingToken.address, amount: AMOUNT_UNDERLYING }],
            recipient.address,
            AMOUNT_DEPENDENT + 1,
            DEADLINE,
          ],
          message: `ReceivedLessThanExpected(${AMOUNT_DEPENDENT})`,
        });
      });
    });
    when('function is called', () => {
      given(async () => {
        await transformer.transformToDependent(
          vault.address,
          [{ underlying: underlyingToken.address, amount: AMOUNT_UNDERLYING }],
          recipient.address,
          AMOUNT_DEPENDENT,
          DEADLINE
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
          recipient.address,
          AMOUNT_DEPENDENT,
          DEADLINE
        );
        expect(amountDependent).to.equal(AMOUNT_DEPENDENT);
      });
    });
  });

  describe('transformToExpectedUnderlying', () => {
    given(() => {
      vault.withdraw.returns(AMOUNT_DEPENDENT);
    });
    invalidUnderlyingInputTest({
      func: 'transformToExpectedUnderlying',
      input: (underlying) => [vault.address, underlying, recipient.address, AMOUNT_DEPENDENT, DEADLINE],
    });
    when('asking for less than needed', () => {
      then('tx reverts with message', async () => {
        await behaviours.txShouldRevertWithMessage({
          contract: transformer,
          func: 'transformToExpectedUnderlying',
          args: [
            vault.address,
            [{ underlying: underlyingToken.address, amount: AMOUNT_UNDERLYING }],
            recipient.address,
            AMOUNT_DEPENDENT - 1,
            DEADLINE,
          ],
          message: `NeededMoreThanExpected(${AMOUNT_DEPENDENT})`,
        });
      });
    });
    when('function is called', () => {
      given(async () => {
        await transformer.transformToExpectedUnderlying(
          vault.address,
          [{ underlying: underlyingToken.address, amount: AMOUNT_UNDERLYING }],
          recipient.address,
          AMOUNT_DEPENDENT,
          DEADLINE
        );
      });
      then('vault is called correctly', () => {
        expect(vault.withdraw).to.have.been.calledOnceWith(AMOUNT_UNDERLYING, recipient.address, signer.address);
      });
      then('returns spent dependent correctly', async () => {
        const spentDependent = await transformer.callStatic.transformToExpectedUnderlying(
          vault.address,
          [{ underlying: underlyingToken.address, amount: AMOUNT_UNDERLYING }],
          recipient.address,
          AMOUNT_DEPENDENT,
          DEADLINE
        );
        expect(spentDependent).to.equal(AMOUNT_DEPENDENT);
      });
    });
  });

  describe('transformToExpectedDependent', () => {
    given(() => {
      vault.previewMint.returns(AMOUNT_UNDERLYING);
      vault.mint.returns(AMOUNT_UNDERLYING);
    });
    invalidUnderlyingInputTest({
      func: 'transformToExpectedDependent',
      input: (underlying) => [vault.address, AMOUNT_DEPENDENT, recipient.address, underlying, DEADLINE],
    });
    when('asking for less than needed', () => {
      then('tx reverts with message', async () => {
        await behaviours.txShouldRevertWithMessage({
          contract: transformer,
          func: 'transformToExpectedDependent',
          args: [
            vault.address,
            AMOUNT_DEPENDENT,
            recipient.address,
            [{ underlying: underlyingToken.address, amount: AMOUNT_UNDERLYING - 1 }],
            DEADLINE,
          ],
          message: `NeededMoreThanExpected(${AMOUNT_UNDERLYING})`,
        });
      });
    });
    when('preview matches mint', () => {
      given(async () => {
        await transformer.transformToExpectedDependent(
          vault.address,
          AMOUNT_DEPENDENT,
          recipient.address,
          [{ underlying: underlyingToken.address, amount: AMOUNT_UNDERLYING }],
          DEADLINE
        );
      });
      then('preview mint is called correctly', () => {
        expect(vault.previewMint).to.have.been.calledOnceWith(AMOUNT_DEPENDENT);
      });
      then('underlying token is taken from caller', () => {
        expect(underlyingToken.transferFrom).to.have.been.calledOnceWith(signer.address, transformer.address, AMOUNT_UNDERLYING);
      });
      then('underlying token is approved for vault', () => {
        expect(underlyingToken.approve).to.have.been.calledOnceWith(vault.address, AMOUNT_UNDERLYING);
      });
      then('mint is called correctly', () => {
        expect(vault.mint).to.have.been.calledOnceWith(AMOUNT_DEPENDENT, recipient.address);
      });
      then('no transfer is executed', () => {
        expect(underlyingToken.transfer).to.not.have.been.called;
      });
      then('dependent amount is returned correctly', async () => {
        const spentUnderlying = await transformer.callStatic.transformToExpectedDependent(
          vault.address,
          AMOUNT_DEPENDENT,
          recipient.address,
          [{ underlying: underlyingToken.address, amount: AMOUNT_UNDERLYING }],
          DEADLINE
        );
        expect(spentUnderlying.length).to.equal(1);
        expect(spentUnderlying[0].amount).to.equal(AMOUNT_UNDERLYING);
        expect(spentUnderlying[0].underlying).to.equal(underlyingToken.address);
      });
    });
    when('mint ends up needing less than expected', () => {
      given(async () => {
        vault.previewMint.returns(AMOUNT_UNDERLYING);
        vault.mint.returns(AMOUNT_UNDERLYING - 1);
        await transformer.transformToExpectedDependent(
          vault.address,
          AMOUNT_DEPENDENT,
          recipient.address,
          [{ underlying: underlyingToken.address, amount: AMOUNT_UNDERLYING }],
          DEADLINE
        );
      });
      then('preview mint is called correctly', () => {
        expect(vault.previewMint).to.have.been.calledOnceWith(AMOUNT_DEPENDENT);
      });
      then('underlying token is taken from caller', () => {
        expect(underlyingToken.transferFrom).to.have.been.calledOnceWith(signer.address, transformer.address, AMOUNT_UNDERLYING);
      });
      then('underlying token is approved for vault and then set to zero', () => {
        expect(underlyingToken.approve).to.have.been.calledTwice;
        expect(underlyingToken.approve).to.have.been.calledWith(vault.address, AMOUNT_UNDERLYING);
        expect(underlyingToken.approve).to.have.been.calledWith(vault.address, 0);
      });
      then('mint is called correctly', () => {
        expect(vault.mint).to.have.been.calledOnceWith(AMOUNT_DEPENDENT, recipient.address);
      });
      then('unspent underlying is returned', () => {
        expect(underlyingToken.transfer).to.have.been.calledOnceWith(signer.address, 1);
      });
    });
  });

  function invalidUnderlyingInputTest({ func, input }: { func: string; input: (_: ITransformer.UnderlyingAmountStruct[]) => any[] }) {
    when('underlying has zero length', () => {
      then('tx reverts with message', async () => {
        await behaviours.txShouldRevertWithMessage({
          contract: transformer,
          func,
          args: input([]),
          message: `InvalidUnderlyingInput`,
        });
      });
    });
    when('underlying has two elements', () => {
      then('tx reverts with message', async () => {
        const element = { underlying: underlyingToken.address, amount: AMOUNT_UNDERLYING };
        await behaviours.txShouldRevertWithMessage({
          contract: transformer,
          func,
          args: input([element, element]),
          message: `InvalidUnderlyingInput`,
        });
      });
    });
  }
});
