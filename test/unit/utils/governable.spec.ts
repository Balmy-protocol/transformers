import { constants, Contract, Wallet } from 'ethers';
import { ethers } from 'hardhat';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { behaviours, wallet, contracts } from '../../utils';
import { given, then, when } from '../../utils/bdd';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { GovernableMock, GovernableMock__factory } from '@typechained';
import { snapshot } from '@utils/evm';

describe('Governable', function () {
  let governor: SignerWithAddress;
  let factory: GovernableMock__factory;
  let governable: GovernableMock;
  let snapshotId: string;

  before('Setup accounts and contracts', async () => {
    [, governor] = await ethers.getSigners();
    factory = await ethers.getContractFactory('solidity/contracts/test/utils/Governable.sol:GovernableMock');
    governable = await factory.deploy(governor.address);
    snapshotId = await snapshot.take();
  });

  beforeEach(async () => {
    await snapshot.revert(snapshotId);
  });

  describe('constructor', () => {
    when('initializing with governor as zero address', () => {
      then('deployment is reverted with reason', async () => {
        await behaviours.deployShouldRevertWithMessage({
          contract: factory,
          args: [constants.AddressZero],
          message: 'GovernorIsZeroAddress',
        });
      });
    });
    when('initialized correctly', () => {
      then('governor is set correctly', async () => {
        expect(await governable.governor()).to.equal(governor.address);
      });
      then('pending governor is empty', async () => {
        expect(await governable.pendingGovernor()).to.equal(constants.AddressZero);
      });
    });
  });

  describe('setPendingGovernor', () => {
    when('setting pending governor', () => {
      let tx: TransactionResponse;
      let pendingGovernor: string;
      given(async () => {
        pendingGovernor = wallet.generateRandomAddress();
        tx = await governable.connect(governor).setPendingGovernor(pendingGovernor);
      });
      then('pending governor is set', async () => {
        expect(await governable.pendingGovernor()).to.be.equal(pendingGovernor);
      });
      then('event is emitted', async () => {
        await expect(tx).to.emit(governable, 'PendingGovernorSet').withArgs(pendingGovernor);
      });
    });

    behaviours.shouldBeExecutableOnlyByGovernor({
      contract: () => governable,
      funcAndSignature: 'setPendingGovernor',
      params: [wallet.generateRandomAddress()],
      governor: () => governor,
    });
  });

  describe('acceptPendingGovernor', () => {
    when('there is a pending governor', () => {
      let tx: TransactionResponse;
      let pendingGovernor: Wallet;
      given(async () => {
        pendingGovernor = await wallet.generateRandom();
        await governable.connect(governor).setPendingGovernor(pendingGovernor.address);
        tx = await governable.connect(pendingGovernor).acceptPendingGovernor();
      });
      then('pending governor becomes governor', async () => {
        expect(await governable.governor()).to.equal(pendingGovernor.address);
      });
      then('pending governor is set to zero', async () => {
        expect(await governable.pendingGovernor()).to.equal(constants.AddressZero);
      });
      then('event is emitted', async () => {
        await expect(tx).to.emit(governable, 'PendingGovernorAccepted');
      });
    });

    shouldBeExecutableOnlyByPendingGovernor({
      contract: () => governable,
      funcAndSignature: 'acceptPendingGovernor',
      governor: () => governor,
    });
  });

  describe('isGovernor', () => {
    when('not querying for governor address', () => {
      then('returns false', async () => {
        expect(await governable.isGovernor(wallet.generateRandomAddress())).to.be.false;
      });
    });
    when('querying for governor address', () => {
      then('returns true', async () => {
        expect(await governable.isGovernor(governor.address)).to.be.true;
      });
    });
  });
  describe('isPendingGovernor', () => {
    when('not querying for pending governor address', () => {
      then('returns false', async () => {
        expect(await governable.isPendingGovernor(wallet.generateRandomAddress())).to.be.false;
      });
    });
    when('querying for pending governor address', () => {
      let pendingGovernor: string;
      given(async () => {
        pendingGovernor = wallet.generateRandomAddress();
        await governable.connect(governor).setPendingGovernor(pendingGovernor);
      });
      then('returns true', async () => {
        expect(await governable.isPendingGovernor(pendingGovernor)).to.be.true;
      });
    });
  });
});

function shouldBeExecutableOnlyByPendingGovernor({
  contract,
  funcAndSignature,
  params,
  governor,
}: {
  contract: () => Contract;
  funcAndSignature: string;
  params?: any[];
  governor: () => SignerWithAddress | Wallet;
}) {
  params = params ?? [];
  when('not called from pending governor', () => {
    let onlyPendingGovernorAllowedTx: Promise<TransactionResponse>;
    given(async () => {
      const notPendingGovernor = await wallet.generateRandom();
      onlyPendingGovernorAllowedTx = contract()
        .connect(notPendingGovernor)
        [funcAndSignature](...params!);
    });
    then('tx is reverted with reason', async () => {
      await expect(onlyPendingGovernorAllowedTx).to.be.revertedWith('OnlyPendingGovernor');
    });
  });
  when('called from pending governor', () => {
    let onlyPendingGovernorAllowedTx: Promise<TransactionResponse>;
    given(async () => {
      const pendingGovernor = await wallet.generateRandom();
      await contract().connect(governor()).setPendingGovernor(pendingGovernor.address);
      onlyPendingGovernorAllowedTx = contract()
        .connect(pendingGovernor)
        [funcAndSignature](...params!);
    });
    then('tx is not reverted or not reverted with reason only pending governor', async () => {
      await expect(onlyPendingGovernorAllowedTx).to.not.be.revertedWith('OnlyPendingGovernor');
    });
  });
}
