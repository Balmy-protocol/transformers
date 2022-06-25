import { constants, utils } from 'ethers';
import { ethers } from 'hardhat';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { behaviours, erc20, wallet } from '../../utils';
import { given, then, when } from '../../utils/bdd';
import { expect } from 'chai';
import { snapshot } from '@utils/evm';
import { CollectableDustMock, CollectableDustMock__factory, ERC20Mock } from '@typechained';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('CollectableDust', function () {
  let governor: SignerWithAddress;
  let token: ERC20Mock;
  let recipient: string;
  let collectableDust: CollectableDustMock;
  let snapshotId: string;

  before('Setup accounts and contracts', async () => {
    [, governor] = await ethers.getSigners();
    const factory: CollectableDustMock__factory = await ethers.getContractFactory(
      'solidity/contracts/test/utils/CollectableDust.sol:CollectableDustMock'
    );
    collectableDust = await factory.deploy(governor.address);
    token = await erc20.deploy({ name: 'Some Token', symbol: 'ST' });
    recipient = wallet.generateRandomAddress();
    snapshotId = await snapshot.take();
  });

  beforeEach(async () => {
    await snapshot.revert(snapshotId);
  });

  describe('sendDust', () => {
    when('sending dust to zero address', () => {
      then('tx is reverted with reason', async () => {
        await behaviours.txShouldRevertWithMessage({
          contract: collectableDust.connect(governor),
          func: 'sendDust',
          args: [token.address, 10, constants.AddressZero],
          message: 'DustRecipientIsZeroAddress',
        });
      });
    });
    when('sending ETH dust', () => {
      const INITIAL_DUST_BALANCE = utils.parseEther('1');
      const DUST_TO_COLLECT = utils.parseEther('0.1');
      let tx: TransactionResponse;
      given(async () => {
        const balanceHex = utils.hexStripZeros(INITIAL_DUST_BALANCE.toHexString());
        await ethers.provider.send('hardhat_setBalance', [collectableDust.address, balanceHex]);
        tx = await collectableDust.connect(governor).sendDust(await collectableDust.PROTOCOL_TOKEN(), DUST_TO_COLLECT, recipient);
      });
      then('eth is collected from contract', async () => {
        expect(await ethers.provider.getBalance(collectableDust.address)).to.equal(INITIAL_DUST_BALANCE.sub(DUST_TO_COLLECT));
      });
      then('eth is sent to recipient', async () => {
        expect(await ethers.provider.getBalance(recipient)).to.equal(DUST_TO_COLLECT);
      });
      then('event is emitted with arguments', async () => {
        await expect(tx)
          .to.emit(collectableDust, 'DustSent')
          .withArgs(await collectableDust.PROTOCOL_TOKEN(), DUST_TO_COLLECT, recipient);
      });
    });
    context('sending erc20 dust', () => {
      const INITIAL_DUST_BALANCE = utils.parseEther('1');
      const DUST_TO_COLLECT = utils.parseEther('0.1');
      let tx: TransactionResponse;
      given(async () => {
        await token.mint(collectableDust.address, INITIAL_DUST_BALANCE);
        tx = await collectableDust.connect(governor).sendDust(token.address, DUST_TO_COLLECT, recipient);
      });
      then('erc20 is collected from contract', async () => {
        expect(await token.balanceOf(collectableDust.address)).to.equal(INITIAL_DUST_BALANCE.sub(DUST_TO_COLLECT));
      });
      then('erc20 is sent to recipient', async () => {
        expect(await token.balanceOf(recipient)).to.equal(DUST_TO_COLLECT);
      });
      then('event is emitted with arguments', async () => {
        await expect(tx).to.emit(collectableDust, 'DustSent').withArgs(token.address, DUST_TO_COLLECT, recipient);
      });
    });

    behaviours.shouldBeExecutableOnlyByGovernor({
      contract: () => collectableDust,
      funcAndSignature: 'sendDust',
      params: () => [token.address, 10, recipient],
      governor: () => governor,
    });
  });
});
