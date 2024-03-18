import chai, { expect } from 'chai';
import { ethers, network } from 'hardhat';
import { given, then, when } from '@utils/bdd';
import { ProtocolTokenWrapperTransformer, ProtocolTokenWrapperTransformer__factory, IWETH9, ITransformer } from '@typechained';
import { snapshot } from '@utils/evm';
import { smock, FakeContract } from '@defi-wonderland/smock';
import { BigNumber, BigNumberish, constants, utils } from 'ethers';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { behaviours } from '@utils';

chai.use(smock.matchers);

describe('ProtocolTokenWrapperTransformer', () => {
  const PROTOCOL_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
  const AMOUNT_TO_MAP = 100000;
  const UNDERLYING = [{ underlying: PROTOCOL_TOKEN, amount: AMOUNT_TO_MAP }];
  const RECIPIENT = '0x000000000000000000000000000000000000000F';
  const DEADLINE = constants.MaxInt256;

  let signer: SignerWithAddress;
  let transformer: ProtocolTokenWrapperTransformer;
  let wToken: FakeContract<IWETH9>;
  let snapshotId: string;

  before('Setup accounts and contracts', async () => {
    await network.provider.request({
      method: 'hardhat_reset',
      params: [],
    });
    [signer] = await ethers.getSigners();
    wToken = await smock.fake('IWETH9');
    const factory: ProtocolTokenWrapperTransformer__factory = await ethers.getContractFactory(
      'solidity/contracts/transformers/ProtocolTokenWrapperTransformer.sol:ProtocolTokenWrapperTransformer'
    );
    transformer = await factory.deploy();
    snapshotId = await snapshot.take();
  });

  beforeEach(async () => {
    await snapshot.revert(snapshotId);
    wToken.withdraw.reset();
    wToken.deposit.reset();
    wToken.transfer.reset();
    wToken.transferFrom.reset();
    wToken.transfer.returns(true);
    wToken.transferFrom.returns(true);
  });

  describe('constructor', () => {
    when('contract is initialized', () => {
      then('protocol token is returned correctly', async () => {
        expect(await transformer.PROTOCOL_TOKEN()).to.equal(PROTOCOL_TOKEN);
      });
    });
  });

  describe('getUnderlying', () => {
    when('function is called', () => {
      then('underlying token is returned correctly', async () => {
        const underlying = await transformer.getUnderlying(wToken.address);
        expect(underlying).to.eql([PROTOCOL_TOKEN]);
      });
    });
  });

  describe('calculateTransformToUnderlying', () => {
    when('function is called', () => {
      let underlying: ITransformer.UnderlyingAmountStructOutput[];
      given(async () => {
        underlying = await transformer.calculateTransformToUnderlying(wToken.address, AMOUNT_TO_MAP);
      });
      then('underlying amount is returned correctly', async () => {
        expect(underlying.length).to.equal(1);
        expect(underlying[0].amount).to.equal(AMOUNT_TO_MAP);
        expect(underlying[0].underlying).to.equal(PROTOCOL_TOKEN);
      });
    });
  });

  describe('calculateTransformToDependent', () => {
    invalidUnderlyingInputTest({
      func: 'calculateTransformToDependent',
      input: (underlying) => [wToken.address, underlying],
    });
    when('function is called', () => {
      let amountDependent: BigNumber;
      given(async () => {
        amountDependent = await transformer.calculateTransformToDependent(wToken.address, [
          { underlying: PROTOCOL_TOKEN, amount: AMOUNT_TO_MAP },
        ]);
      });
      then('dependent amount is returned correctly', async () => {
        expect(amountDependent).to.equal(AMOUNT_TO_MAP);
      });
    });
  });

  describe('calculateNeededToTransformToUnderlying', () => {
    invalidUnderlyingInputTest({
      func: 'calculateNeededToTransformToUnderlying',
      input: (underlying) => [wToken.address, underlying],
    });
    when('function is called', () => {
      let neededDependent: BigNumber;
      given(async () => {
        neededDependent = await transformer.calculateNeededToTransformToUnderlying(wToken.address, [
          { underlying: PROTOCOL_TOKEN, amount: AMOUNT_TO_MAP },
        ]);
      });
      then('needed dependent is returned correctly', async () => {
        expect(neededDependent).to.equal(AMOUNT_TO_MAP);
      });
    });
  });

  describe('calculateNeededToTransformToDependent', () => {
    when('function is called', () => {
      let neededUnderlying: ITransformer.UnderlyingAmountStructOutput[];
      given(async () => {
        neededUnderlying = await transformer.calculateNeededToTransformToDependent(wToken.address, AMOUNT_TO_MAP);
      });
      then('needed underlying is returned correctly', async () => {
        expect(neededUnderlying.length).to.equal(1);
        expect(neededUnderlying[0].amount).to.equal(AMOUNT_TO_MAP);
        expect(neededUnderlying[0].underlying).to.equal(PROTOCOL_TOKEN);
      });
    });
  });

  describe('transformToUnderlying', () => {
    invalidUnderlyingInputTest({
      func: 'transformToUnderlying',
      input: (underlying) => [wToken.address, AMOUNT_TO_MAP, RECIPIENT, underlying, DEADLINE],
    });
    when('asking for more than received', () => {
      then('tx reverts with message', async () => {
        await behaviours.txShouldRevertWithMessage({
          contract: transformer,
          func: 'transformToUnderlying',
          args: [wToken.address, AMOUNT_TO_MAP, RECIPIENT, [{ underlying: PROTOCOL_TOKEN, amount: AMOUNT_TO_MAP + 1 }], DEADLINE],
          message: `ReceivedLessThanExpected(${AMOUNT_TO_MAP})`,
        });
      });
    });
    when('function is called', () => {
      given(async () => {
        // We are setting balance to the transformer, to simulate a withdraw from the wToken
        await setBalance(transformer.address, AMOUNT_TO_MAP);
        await transformer.transformToUnderlying(wToken.address, AMOUNT_TO_MAP, RECIPIENT, UNDERLYING, DEADLINE);
      });
      then('wToken is taken from caller', () => {
        expect(wToken.transferFrom).to.have.been.calledOnceWith(signer.address, transformer.address, AMOUNT_TO_MAP);
      });
      then('wToken is called correctly', () => {
        expect(wToken.withdraw).to.have.been.calledOnceWith(AMOUNT_TO_MAP);
      });
      then('protocol token is transferred correctly to the recipient', async () => {
        const balance = await ethers.provider.getBalance(RECIPIENT);
        expect(balance).to.equal(AMOUNT_TO_MAP);
      });
      then('protocol token is removed from the transformer', async () => {
        const balance = await ethers.provider.getBalance(transformer.address);
        expect(balance).to.equal(0);
      });
      then('underlying amount is returned correctly', async () => {
        // We are setting balance to the transformer, to simulate a withdraw from the wToken
        setBalance(transformer.address, AMOUNT_TO_MAP);
        const underlying = await transformer.callStatic.transformToUnderlying(wToken.address, AMOUNT_TO_MAP, RECIPIENT, UNDERLYING, DEADLINE);
        expect(underlying.length).to.equal(1);
        expect(underlying[0].amount).to.equal(AMOUNT_TO_MAP);
        expect(underlying[0].underlying).to.equal(PROTOCOL_TOKEN);
      });
    });
  });

  describe('transformToDependent', () => {
    invalidUnderlyingInputTest({
      func: 'transformToDependent',
      input: (underlying) => [wToken.address, underlying, RECIPIENT, AMOUNT_TO_MAP, DEADLINE],
    });
    when('asking for more than received', () => {
      then('tx reverts with message', async () => {
        await behaviours.txShouldRevertWithMessage({
          contract: transformer,
          func: 'transformToDependent',
          args: [wToken.address, [{ underlying: PROTOCOL_TOKEN, amount: AMOUNT_TO_MAP }], RECIPIENT, AMOUNT_TO_MAP + 1, DEADLINE],
          message: `ReceivedLessThanExpected(${AMOUNT_TO_MAP})`,
        });
      });
    });
    when('sending less in value than specified as parameter', () => {
      let tx: Promise<TransactionResponse>;
      given(() => {
        tx = transformer.transformToDependent(wToken.address, UNDERLYING, RECIPIENT, AMOUNT_TO_MAP, DEADLINE, {
          value: AMOUNT_TO_MAP - 1,
        });
      });
      then('tx reverts', async () => {
        await expect(tx).to.have.reverted;
      });
    });
    when('function is called correctly', () => {
      given(async () => {
        await transformer.transformToDependent(wToken.address, UNDERLYING, RECIPIENT, AMOUNT_TO_MAP, DEADLINE, {
          value: AMOUNT_TO_MAP,
        });
      });
      then('protocol token has been sent to wToken', async () => {
        const balance = await ethers.provider.getBalance(wToken.address);
        expect(balance).to.equal(AMOUNT_TO_MAP);
      });
      then('transformer has no protocol token', async () => {
        const balance = await ethers.provider.getBalance(transformer.address);
        expect(balance).to.equal(0);
      });
      then('wToken is called correctly', () => {
        expect(wToken.deposit).to.have.been.calledOnce;
      });
      then('dependent token is transferred to recipient', () => {
        expect(wToken.transfer).to.have.been.calledOnceWith(RECIPIENT, AMOUNT_TO_MAP);
      });
      then('dependent amount is returned correctly', async () => {
        const amountDependent = await transformer.callStatic.transformToDependent(
          wToken.address,
          UNDERLYING,
          RECIPIENT,
          AMOUNT_TO_MAP,
          DEADLINE,
          {
            value: AMOUNT_TO_MAP,
          }
        );
        expect(amountDependent).to.equal(AMOUNT_TO_MAP);
      });
    });
  });

  describe('transformToExpectedUnderlying', () => {
    when('asking for less than needed', () => {
      then('tx reverts with message', async () => {
        await behaviours.txShouldRevertWithMessage({
          contract: transformer,
          func: 'transformToExpectedUnderlying',
          args: [wToken.address, [{ underlying: PROTOCOL_TOKEN, amount: AMOUNT_TO_MAP }], RECIPIENT, AMOUNT_TO_MAP - 1, DEADLINE],
          message: `NeededMoreThanExpected(${AMOUNT_TO_MAP})`,
        });
      });
    });
    invalidUnderlyingInputTest({
      func: 'transformToExpectedUnderlying',
      input: (underlying) => [wToken.address, underlying, RECIPIENT, AMOUNT_TO_MAP, DEADLINE],
    });
    when('function is called', () => {
      given(async () => {
        // We are setting balance to the transformer, to simulate a withdraw from the wToken
        await setBalance(transformer.address, AMOUNT_TO_MAP);
        await transformer.transformToExpectedUnderlying(wToken.address, UNDERLYING, RECIPIENT, AMOUNT_TO_MAP, DEADLINE);
      });
      then('wToken is taken from caller', () => {
        expect(wToken.transferFrom).to.have.been.calledOnceWith(signer.address, transformer.address, AMOUNT_TO_MAP);
      });
      then('wToken is called correctly', () => {
        expect(wToken.withdraw).to.have.been.calledOnceWith(AMOUNT_TO_MAP);
      });
      then('protocol token is transferred correctly to the recipient', async () => {
        const balance = await ethers.provider.getBalance(RECIPIENT);
        expect(balance).to.equal(AMOUNT_TO_MAP);
      });
      then('protocol token is removed from the transformer', async () => {
        const balance = await ethers.provider.getBalance(transformer.address);
        expect(balance).to.equal(0);
      });
      then('returns spent dependent correctly', async () => {
        // We are setting balance to the transformer, to simulate a withdraw from the wToken
        await setBalance(transformer.address, AMOUNT_TO_MAP);
        const spentDependent = await transformer.callStatic.transformToExpectedUnderlying(
          wToken.address,
          UNDERLYING,
          RECIPIENT,
          AMOUNT_TO_MAP,
          DEADLINE
        );
        expect(spentDependent).to.equal(AMOUNT_TO_MAP);
      });
    });
  });

  describe('transformToExpectedDependent', () => {
    invalidUnderlyingInputTest({
      func: 'transformToExpectedDependent',
      input: (underlying) => [wToken.address, AMOUNT_TO_MAP, RECIPIENT, underlying, DEADLINE],
    });
    when('asking for less than needed', () => {
      then('tx reverts with message', async () => {
        await behaviours.txShouldRevertWithMessage({
          contract: transformer,
          func: 'transformToExpectedDependent',
          args: [wToken.address, AMOUNT_TO_MAP, RECIPIENT, [{ underlying: PROTOCOL_TOKEN, amount: AMOUNT_TO_MAP - 1 }], DEADLINE],
          message: `NeededMoreThanExpected(${AMOUNT_TO_MAP})`,
        });
      });
    });
    when('sending less in value than specified as parameter', () => {
      let tx: Promise<TransactionResponse>;
      given(() => {
        tx = transformer.transformToExpectedDependent(wToken.address, AMOUNT_TO_MAP, RECIPIENT, UNDERLYING, DEADLINE, {
          value: AMOUNT_TO_MAP - 1,
        });
      });
      then('tx reverts', async () => {
        await expect(tx).to.have.reverted;
      });
    });
    when('function is called correctly', () => {
      given(async () => {
        await transformer.transformToExpectedDependent(wToken.address, AMOUNT_TO_MAP, RECIPIENT, UNDERLYING, DEADLINE, {
          value: AMOUNT_TO_MAP,
        });
      });
      then('protocol token has been sent to wToken', async () => {
        const balance = await ethers.provider.getBalance(wToken.address);
        expect(balance).to.equal(AMOUNT_TO_MAP);
      });
      then('transformer has no protocol token', async () => {
        const balance = await ethers.provider.getBalance(transformer.address);
        expect(balance).to.equal(0);
      });
      then('wToken is called correctly', () => {
        expect(wToken.deposit).to.have.been.calledOnce;
      });
      then('dependent token is transferred to recipient', () => {
        expect(wToken.transfer).to.have.been.calledOnceWith(RECIPIENT, AMOUNT_TO_MAP);
      });
      then('returns spent underlying correctly', async () => {
        const spentUnderlying = await transformer.callStatic.transformToExpectedDependent(
          wToken.address,
          AMOUNT_TO_MAP,
          RECIPIENT,
          UNDERLYING,
          DEADLINE,
          {
            value: AMOUNT_TO_MAP,
          }
        );
        expect(spentUnderlying.length).to.equal(1);
        expect(spentUnderlying[0].amount).to.equal(AMOUNT_TO_MAP);
        expect(spentUnderlying[0].underlying).to.equal(PROTOCOL_TOKEN);
      });
    });
  });

  async function setBalance(address: string, amount: BigNumberish) {
    const amountToSwapHex = utils.hexStripZeros(BigNumber.from(amount).toHexString());
    await ethers.provider.send('hardhat_setBalance', [address, amountToSwapHex]);
  }

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
        const element = { underlying: PROTOCOL_TOKEN, amount: AMOUNT_TO_MAP };
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
