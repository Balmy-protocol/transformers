import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { then, when } from '@utils/bdd';
import { ProtocolTokenWrapperTransformer, ProtocolTokenWrapperTransformer__factory, IWETH9 } from '@typechained';
import { snapshot } from '@utils/evm';
import { smock, FakeContract } from '@defi-wonderland/smock';

chai.use(smock.matchers);

describe('ProtocolTokenWrapperTransformer', () => {
  const PROTOCOL_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

  let transformer: ProtocolTokenWrapperTransformer;
  let wToken: FakeContract<IWETH9>;
  let snapshotId: string;

  before('Setup accounts and contracts', async () => {
    wToken = await smock.fake('IERC4626');
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
});
