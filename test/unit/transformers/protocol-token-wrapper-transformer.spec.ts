import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { given, then, when } from '@utils/bdd';
import { ProtocolTokenWrapperTransformer, ProtocolTokenWrapperTransformer__factory, IWETH9, ITransformer } from '@typechained';
import { snapshot } from '@utils/evm';
import { smock, FakeContract } from '@defi-wonderland/smock';
import { BigNumber, BigNumberish, utils } from 'ethers';

chai.use(smock.matchers);

describe('ProtocolTokenWrapperTransformer', () => {
  const PROTOCOL_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
  const AMOUNT_TO_MAP = 100000;
  const RECIPIENT = '0x000000000000000000000000000000000000000F';

  let transformer: ProtocolTokenWrapperTransformer;
  let wToken: FakeContract<IWETH9>;
  let snapshotId: string;

  before('Setup accounts and contracts', async () => {
    wToken = await smock.fake('IWETH9');
    const adapterFactory: ProtocolTokenWrapperTransformer__factory = await ethers.getContractFactory(
      'solidity/contracts/transformers/ProtocolTokenWrapperTransformer.sol:ProtocolTokenWrapperTransformer'
    );
    transformer = await adapterFactory.deploy();
    snapshotId = await snapshot.take();
  });

  beforeEach(async () => {
    await snapshot.revert(snapshotId);
    wToken.withdraw.reset();
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

  describe('transformToUnderlying', () => {
    when('function is called', () => {
      given(async () => {
        // We are setting balance to the transformer, to simulate a withdraw from the wToken
        setBalance(transformer.address, AMOUNT_TO_MAP);
        await transformer.transformToUnderlying(wToken.address, AMOUNT_TO_MAP, RECIPIENT);
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
        const underlying = await transformer.callStatic.transformToUnderlying(wToken.address, AMOUNT_TO_MAP, RECIPIENT);
        expect(underlying.length).to.equal(1);
        expect(underlying[0].amount).to.equal(AMOUNT_TO_MAP);
        expect(underlying[0].underlying).to.equal(PROTOCOL_TOKEN);
      });
    });
  });
  async function setBalance(address: string, amount: BigNumberish) {
    const amountToSwapHex = utils.hexStripZeros(BigNumber.from(amount).toHexString());
    await ethers.provider.send('hardhat_setBalance', [address, amountToSwapHex]);
  }
});