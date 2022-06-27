import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { given, then, when } from '@utils/bdd';
import { TransformerRegistry, TransformerRegistry__factory, ITransformer, ERC165__factory, ITransformer__factory } from '@typechained';
import { snapshot } from '@utils/evm';
import { smock, FakeContract } from '@defi-wonderland/smock';
import { constants, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { behaviours } from '@utils';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { IERC165 } from '@mean-finance/deterministic-factory/typechained';
import { readArgFromEventOrFail } from '@utils/event-utils';
const { makeInterfaceId } = require('@openzeppelin/test-helpers');

chai.use(smock.matchers);

describe('TransformerRegistry', () => {
  const DEPENDENT = '0x0000000000000000000000000000000000000001';

  let governor: SignerWithAddress;
  let transformer: FakeContract<ITransformer>;
  let registry: TransformerRegistry;
  let snapshotId: string;

  before('Setup accounts and contracts', async () => {
    [, governor] = await ethers.getSigners();
    transformer = await smock.fake('ITransformer');
    const factory: TransformerRegistry__factory = await ethers.getContractFactory(
      'solidity/contracts/TransformerRegistry.sol:TransformerRegistry'
    );
    registry = await factory.deploy(governor.address);
    snapshotId = await snapshot.take();
  });

  beforeEach(async () => {
    await snapshot.revert(snapshotId);
  });

  describe('registerTransformers', () => {
    let transformer: FakeContract<IERC165>;
    given(async () => {
      transformer = await smock.fake('IERC165');
    });
    when(`given transformer doesn't implement ERC165`, () => {
      then('tx reverts with message', async () => {
        await behaviours.txShouldRevertWithMessage({
          contract: registry.connect(governor),
          func: 'registerTransformers',
          args: [[{ transformer: constants.AddressZero, dependents: [DEPENDENT] }]],
          message: `AddressIsNotTransformer`,
        });
      });
    });
    when('given transformer does not implement ITransformer', () => {
      given(async () => {
        transformer.supportsInterface.returns(false);
      });
      then('tx reverts with message', async () => {
        await behaviours.txShouldRevertWithMessage({
          contract: registry.connect(governor),
          func: 'registerTransformers',
          args: [[{ transformer: transformer.address, dependents: [DEPENDENT] }]],
          message: `AddressIsNotTransformer`,
        });
      });
    });
    when('given transformer implements ITransformer', () => {
      let tx: TransactionResponse;
      given(async () => {
        transformer.supportsInterface.returns(
          ({ interfaceId }: { interfaceId: string }) =>
            interfaceId === getInterfaceId(ERC165__factory.createInterface()) ||
            interfaceId === getInterfaceId(ITransformer__factory.createInterface())
        );
        tx = await registry.connect(governor).registerTransformers([{ transformer: transformer.address, dependents: [DEPENDENT] }]);
      });
      then('transformer is called correctly', () => {
        expect(transformer.supportsInterface).to.have.been.calledThrice;
        expect(transformer.supportsInterface).to.have.been.calledWith('0xffffffff');
        expect(transformer.supportsInterface).to.have.been.calledWith(getInterfaceId(ERC165__factory.createInterface()));
        expect(transformer.supportsInterface).to.have.been.calledWith(getInterfaceId(ITransformer__factory.createInterface()));
      });
      then('dependents are registered correctly', async () => {
        const transformers = await registry.transformers([DEPENDENT]);
        expect(transformers).to.eql([transformer.address]);
      });
      then('event is emitted', async () => {
        const registrations = await readArgFromEventOrFail<{ transformer: string; dependents: string[] }[]>(
          tx,
          'TransformersRegistered',
          'registrations'
        );
        expect(registrations.length).to.equal(1);
        expect(registrations[0].transformer).to.equal(transformer.address);
        expect(registrations[0].dependents).to.eql([DEPENDENT]);
      });
    });
    function getInterfaceId(interface_: utils.Interface) {
      const functions = 'functions' in interface_ ? Object.keys(interface_.functions) : interface_;
      return makeInterfaceId.ERC165(functions);
    }
    behaviours.shouldBeExecutableOnlyByGovernor({
      contract: () => registry,
      funcAndSignature: 'registerTransformers',
      params: () => [[{ transformer: transformer.address, dependents: [DEPENDENT] }]],
      governor: () => governor,
    });
  });
});
