import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { given, then, when } from '@utils/bdd';
import { IstETH, ITransformer, IwstETH, WstETHTransformer, WstETHTransformer__factory } from '@typechained';
import { snapshot } from '@utils/evm';
import { smock, FakeContract } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { behaviours } from '@utils';
import { BigNumber } from 'ethers';

chai.use(smock.matchers);

describe('wstETHTransformer', () => {
  const TOTAL_SHARES = 456789;
  const TOTAL_SUPPLY = 3333;
  const AMOUNT_DEPENDENT = 100000;
  const AMOUNT_UNDERLYING = 12345678;

  let signer: SignerWithAddress, recipient: SignerWithAddress;
  let transformer: WstETHTransformer;
  let wstETH: FakeContract<IwstETH>;
  let stETH: FakeContract<IstETH>;
  let snapshotId: string;

  before('Setup accounts and contracts', async () => {
    [signer, recipient] = await ethers.getSigners();
    wstETH = await smock.fake('IwstETH');
    stETH = await smock.fake('IstETH');
    const factory: WstETHTransformer__factory = await ethers.getContractFactory('wstETHTransformer');
    transformer = await factory.deploy(stETH.address, signer.address);
    snapshotId = await snapshot.take();
  });

  beforeEach(async () => {
    await snapshot.revert(snapshotId);
    stETH.getTotalShares.returns(TOTAL_SHARES);
    stETH.totalSupply.returns(TOTAL_SUPPLY);
  });

  afterEach(() => {
    stETH.getTotalShares.reset();
    stETH.totalSupply.reset();
  });

  describe('constructor', () => {
    when('contract is deployed', () => {
      then('stETH is set correctly', async () => {
        expect(await transformer.stETH()).to.equal(stETH.address);
      });
    });
  });

  describe('getUnderlying', () => {
    when('function is called', () => {
      then('underlying token is returned correctly', async () => {
        const underlying = await transformer.getUnderlying(stETH.address);
        expect(underlying).to.eql([stETH.address]);
      });
    });
  });

  describe('calculateTransformToUnderlying', () => {
    when('function is called', () => {
      let underlying: ITransformer.UnderlyingAmountStructOutput[];
      given(async () => {
        stETH.getPooledEthByShares.returns(AMOUNT_UNDERLYING);
        underlying = await transformer.calculateTransformToUnderlying(wstETH.address, AMOUNT_DEPENDENT);
      });
      then('stETH is called correctly', () => {
        expect(stETH.getPooledEthByShares).to.have.been.calledOnceWith(AMOUNT_DEPENDENT);
      });
      then('underlying amount is returned correctly', async () => {
        expect(underlying).to.have.lengthOf(1);
        expect(underlying[0].amount).to.equal(AMOUNT_UNDERLYING);
        expect(underlying[0].underlying).to.equal(stETH.address);
      });
    });
  });

  describe('calculateTransformToDependent', () => {
    invalidUnderlyingInputTest({
      func: 'calculateTransformToDependent',
      input: (underlying) => [wstETH.address, underlying],
    });
    when('function is called', () => {
      let amountDependent: BigNumber;
      given(async () => {
        stETH.getSharesByPooledEth.returns(AMOUNT_DEPENDENT);
        amountDependent = await transformer.calculateTransformToDependent(wstETH.address, [
          { underlying: stETH.address, amount: AMOUNT_UNDERLYING },
        ]);
      });
      then('stETH is called correctly', () => {
        expect(stETH.getSharesByPooledEth).to.have.been.calledOnceWith(AMOUNT_UNDERLYING);
      });
      then('dependent amount is returned correctly', async () => {
        expect(amountDependent).to.equal(AMOUNT_DEPENDENT);
      });
    });
  });

  describe('calculateNeededToTransformToUnderlying', () => {
    invalidUnderlyingInputTest({
      func: 'calculateNeededToTransformToUnderlying',
      input: (underlying) => [wstETH.address, underlying],
    });
    when('function is called', () => {
      let neededDependent: BigNumber;
      given(async () => {
        neededDependent = await transformer.calculateNeededToTransformToUnderlying(wstETH.address, [
          { underlying: stETH.address, amount: AMOUNT_UNDERLYING },
        ]);
      });
      then('stETH is called correctly', () => {
        expect(stETH.getTotalShares).to.have.been.calledOnce;
        expect(stETH.totalSupply).to.have.been.calledOnce;
      });
      then('needed dependent is returned correctly', async () => {
        const expected = BigNumber.from(AMOUNT_UNDERLYING).mul(TOTAL_SHARES).div(TOTAL_SUPPLY).add(1);
        expect(neededDependent).to.equal(expected);
      });
    });
  });

  describe('calculateNeededToTransformToDependent', () => {
    when('function is called', () => {
      let neededUnderlying: ITransformer.UnderlyingAmountStructOutput[];
      given(async () => {
        neededUnderlying = await transformer.calculateNeededToTransformToDependent(wstETH.address, AMOUNT_DEPENDENT);
      });
      then('stETH is called correctly', () => {
        expect(stETH.getTotalShares).to.have.been.calledOnce;
        expect(stETH.totalSupply).to.have.been.calledOnce;
      });
      then('needed underlying is returned correctly', async () => {
        const expected = BigNumber.from(AMOUNT_DEPENDENT).mul(TOTAL_SUPPLY).div(TOTAL_SHARES).add(1);
        expect(neededUnderlying.length).to.equal(1);
        expect(neededUnderlying[0].amount).to.equal(expected);
        expect(neededUnderlying[0].underlying).to.equal(stETH.address);
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
        const element = { underlying: stETH.address, amount: AMOUNT_UNDERLYING };
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
