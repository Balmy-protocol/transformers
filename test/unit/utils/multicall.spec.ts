import { BigNumber, BytesLike, constants, utils } from 'ethers';
import { ethers } from 'hardhat';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { given, then, when } from '../../utils/bdd';
import { expect } from 'chai';
import { snapshot } from '@utils/evm';
import { MulticallMock, MulticallMock__factory } from '@typechained';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('Multicall', function () {
  let signer: SignerWithAddress;
  let recipient1: SignerWithAddress, recipient2: SignerWithAddress, recipient3: SignerWithAddress;
  let multicall: MulticallMock;
  let snapshotId: string;

  before('Setup accounts and contracts', async () => {
    [signer, recipient1, recipient2, recipient3] = await ethers.getSigners();
    const factory: MulticallMock__factory = await ethers.getContractFactory('solidity/contracts/test/utils/Multicall.sol:MulticallMock');
    multicall = await factory.deploy();
    snapshotId = await snapshot.take();
  });

  beforeEach(async () => {
    await snapshot.revert(snapshotId);
  });

  /*
  We've built our own multicall so that we can make it payable. The idea is that we can send a lot of ether
  to the multicall and use different portions in different subcalls. So we will now be testing that we can
  actually distribute it.  
  */
  describe('multicall', () => {
    when('using multicall for distribute ether', () => {
      let recipients: { address: string; toTransfer: BigNumber }[];
      let initialBalances: Map<string, BigNumber> = new Map();
      given(async () => {
        recipients = [
          { address: recipient1.address, toTransfer: utils.parseEther('0.1') },
          { address: recipient2.address, toTransfer: utils.parseEther('0.2') },
          { address: recipient3.address, toTransfer: utils.parseEther('0.3') },
        ];

        let total = constants.Zero;
        let calls: BytesLike[] = [];
        for (const { address, toTransfer } of recipients) {
          total = total.add(toTransfer);
          initialBalances.set(address, await ethers.provider.getBalance(address));
          const { data } = await multicall.populateTransaction.sendEthToAddress(address, toTransfer);
          calls.push(data!);
        }
        await multicall.multicall(calls, { value: total });
      });
      then('ether is transferred correctly', async () => {
        for (const { address, toTransfer } of recipients) {
          expect(await ethers.provider.getBalance(address)).to.equal(initialBalances.get(address)!.add(toTransfer));
        }
      });
      then('multicall contract has no balance left', async () => {
        expect(await ethers.provider.getBalance(multicall.address)).to.equal(0);
      });
    });
  });
  when('using multicall to move more ether than sent to multicall', () => {
    let tx: Promise<TransactionResponse>;
    given(async () => {
      const toTransfer = utils.parseEther('0.1');
      const { data } = await multicall.populateTransaction.sendEthToAddress(recipient1.address, toTransfer);
      tx = multicall.multicall([data!], { value: toTransfer.sub(1) });
    });
    then('tx reverts', async () => {
      await expect(tx).to.have.reverted;
    });
  });
});
