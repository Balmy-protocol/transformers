import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { given, then, when } from '@utils/bdd';
import { ProtocolTokenWrapperTransformer, ProtocolTokenWrapperTransformer__factory, IWETH9, ITransformer } from '@typechained';
import { snapshot } from '@utils/evm';
import { smock, FakeContract } from '@defi-wonderland/smock';
import { BigNumber } from 'ethers';

chai.use(smock.matchers);

describe('ProtocolTokenWrapperTransformer', () => {
  const PROTOCOL_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
  const AMOUNT_TO_MAP = 100000;

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
});
