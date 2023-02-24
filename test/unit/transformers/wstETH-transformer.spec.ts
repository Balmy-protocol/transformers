import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { then, when } from '@utils/bdd';
import { ERC4626Transformer, IstETH, IwstETH, WstETHTransformer__factory } from '@typechained';
import { snapshot } from '@utils/evm';
import { smock, FakeContract } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

chai.use(smock.matchers);

describe('wstETHTransformer', () => {
  let signer: SignerWithAddress, recipient: SignerWithAddress;
  let transformer: ERC4626Transformer;
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
  });

  describe('getUnderlying', () => {
    when('function is called', () => {
      then('underlying token is returned correctly', async () => {
        const underlying = await transformer.getUnderlying(stETH.address);
        expect(underlying).to.eql([stETH.address]);
      });
    });
  });
});
