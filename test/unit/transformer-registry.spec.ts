import chai, { expect } from 'chai';
import { ethers } from 'hardhat';
import { given, then, when } from '@utils/bdd';
import {
  TransformerRegistry,
  TransformerRegistry__factory,
  ITransformer,
  ERC165__factory,
  ITransformer__factory,
  ITransformerERC165,
} from '@typechained';
import { snapshot } from '@utils/evm';
import { smock, FakeContract } from '@defi-wonderland/smock';
import { BigNumber, constants, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { behaviours } from '@utils';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { readArgFromEventOrFail } from '@utils/event-utils';
import { IERC20 } from '@mean-finance/deterministic-factory';
const { makeInterfaceId } = require('@openzeppelin/test-helpers');

chai.use(smock.matchers);

describe('TransformerRegistry', () => {
  const ERC_165_INTERFACE_ID = getInterfaceId(ERC165__factory.createInterface());
  const TRANSFORMER_INTERFACE_ID = getInterfaceId(ITransformer__factory.createInterface());
  const DEPENDENT_AMOUNT = BigNumber.from(10000);
  const UNDERLYING_AMOUNT = [{ underlying: constants.AddressZero, amount: DEPENDENT_AMOUNT }];
  const RECIPIENT = '0x0000000000000000000000000000000000000002';
  const DEADLINE = constants.MaxInt256;

  let signer: SignerWithAddress, governor: SignerWithAddress;
  let transformer: FakeContract<ITransformerERC165>;
  let registry: TransformerRegistry;
  let dependent: FakeContract<IERC20>;
  let snapshotId: string;

  before('Setup accounts and contracts', async () => {
    [signer, governor] = await ethers.getSigners();
    transformer = await smock.fake('ITransformerERC165');
    const factory: TransformerRegistry__factory = await ethers.getContractFactory(
      'solidity/contracts/TransformerRegistry.sol:TransformerRegistry'
    );
    registry = await factory.deploy(governor.address);
    dependent = await smock.fake('IERC20');
    snapshotId = await snapshot.take();
  });

  beforeEach(async () => {
    await snapshot.revert(snapshotId);
    dependent.balanceOf.reset();
    transformer.transformToUnderlying.reset();
    transformer.transformToDependent.reset();
    transformer.supportsInterface.reset();
    transformer.supportsInterface.returns(
      ({ interfaceId }: { interfaceId: string }) => interfaceId === ERC_165_INTERFACE_ID || interfaceId === TRANSFORMER_INTERFACE_ID
    );
  });

  describe('registerTransformers', () => {
    when(`given transformer doesn't implement ERC165`, () => {
      then('tx reverts with message', async () => {
        await behaviours.txShouldRevertWithMessage({
          contract: registry.connect(governor),
          func: 'registerTransformers',
          args: [[{ transformer: constants.AddressZero, dependents: [dependent.address] }]],
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
          args: [[{ transformer: transformer.address, dependents: [dependent.address] }]],
          message: `AddressIsNotTransformer`,
        });
      });
    });
    when('given transformer implements ITransformer', () => {
      let tx: TransactionResponse;
      given(async () => {
        tx = await registry.connect(governor).registerTransformers([{ transformer: transformer.address, dependents: [dependent.address] }]);
      });
      then('transformer is called correctly', () => {
        expect(transformer.supportsInterface).to.have.been.calledThrice;
        expect(transformer.supportsInterface).to.have.been.calledWith('0xffffffff');
        expect(transformer.supportsInterface).to.have.been.calledWith(ERC_165_INTERFACE_ID);
        expect(transformer.supportsInterface).to.have.been.calledWith(TRANSFORMER_INTERFACE_ID);
      });
      then('dependents are registered correctly', async () => {
        const transformers = await registry.transformers([dependent.address]);
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
        expect(registrations[0].dependents).to.eql([dependent.address]);
      });
    });
    behaviours.shouldBeExecutableOnlyByGovernor({
      contract: () => registry,
      funcAndSignature: 'registerTransformers',
      params: () => [[{ transformer: transformer.address, dependents: [dependent.address] }]],
      governor: () => governor,
    });
  });

  describe('removeTransformers', () => {
    when('removing transformers', () => {
      let tx: TransactionResponse;
      given(async () => {
        await registry.connect(governor).registerTransformers([{ transformer: transformer.address, dependents: [dependent.address] }]);
        tx = await registry.connect(governor).removeTransformers([dependent.address]);
      });
      then('dependents are removed correctly', async () => {
        const transformers = await registry.transformers([dependent.address]);
        expect(transformers).to.eql([constants.AddressZero]);
      });
      then('event is emitted', async () => {
        await expect(tx).to.emit(registry, 'TransformersRemoved').withArgs([dependent.address]);
      });
    });
    behaviours.shouldBeExecutableOnlyByGovernor({
      contract: () => registry,
      funcAndSignature: 'removeTransformers',
      params: () => [[dependent.address]],
      governor: () => governor,
    });
  });

  delegateViewTest({
    method: 'getUnderlying',
    args: () => [dependent.address],
    returns: [RECIPIENT],
  });

  delegateViewTest({
    method: 'calculateTransformToUnderlying',
    args: () => [dependent.address, DEPENDENT_AMOUNT],
    returns: UNDERLYING_AMOUNT as any,
  });

  delegateViewTest({
    method: 'calculateTransformToDependent',
    args: () => [dependent.address, UNDERLYING_AMOUNT],
    returns: DEPENDENT_AMOUNT,
  });

  delegateViewTest({
    method: 'calculateNeededToTransformToUnderlying',
    args: () => [dependent.address, UNDERLYING_AMOUNT],
    returns: DEPENDENT_AMOUNT,
  });

  delegateViewTest({
    method: 'calculateNeededToTransformToDependent',
    args: () => [dependent.address, DEPENDENT_AMOUNT],
    returns: UNDERLYING_AMOUNT as any,
  });

  delegateTest({
    method: 'transformToUnderlying',
    args: () => [dependent.address, DEPENDENT_AMOUNT, RECIPIENT, UNDERLYING_AMOUNT, DEADLINE],
    returns: UNDERLYING_AMOUNT as any,
    specialArgAssertion: (args) => {
      expect(args[0]).to.equal(dependent.address);
      expect(args[1]).to.equal(DEPENDENT_AMOUNT);
      expect(args[2]).to.equal(RECIPIENT);
      expect(args[3]).to.have.lengthOf(1);
      expect(args[3][0].underlying).to.equal(UNDERLYING_AMOUNT[0].underlying);
      expect(args[3][0].amount).to.equal(UNDERLYING_AMOUNT[0].amount);
    },
  });

  delegateTest({
    method: 'transformToDependent',
    args: () => [dependent.address, UNDERLYING_AMOUNT, RECIPIENT, DEPENDENT_AMOUNT, DEADLINE],
    returns: DEPENDENT_AMOUNT,
    specialArgAssertion: (args) => {
      expect(args[0]).to.equal(dependent.address);
      expect(args[1]).to.have.lengthOf(1);
      expect(args[1][0].underlying).to.equal(UNDERLYING_AMOUNT[0].underlying);
      expect(args[1][0].amount).to.equal(UNDERLYING_AMOUNT[0].amount);
      expect(args[2]).to.equal(RECIPIENT);
      expect(args[3]).to.equal(DEPENDENT_AMOUNT);
    },
  });

  describe('transformAllToUnderlying', () => {
    assertFailsWithUnknownDependent('transformAllToUnderlying', () => [dependent.address, RECIPIENT, UNDERLYING_AMOUNT, DEADLINE]);
    when('dependent is registered', () => {
      given(async () => {
        await registry.connect(governor).registerTransformers([{ transformer: transformer.address, dependents: [dependent.address] }]);
        transformer.transformToUnderlying.returns(UNDERLYING_AMOUNT);
        dependent.balanceOf.returns(DEPENDENT_AMOUNT);
        await registry.transformAllToUnderlying(dependent.address, RECIPIENT, UNDERLYING_AMOUNT, DEADLINE);
      });
      then('balance of is called correctly', async () => {
        expect(dependent.balanceOf).to.have.been.calledOnceWith(signer.address);
      });
      then('delegation worked as expected', async () => {
        expect(transformer.transformToUnderlying).to.have.been.calledOnce.delegatedFrom(registry.address);
        const args = transformer.transformToUnderlying.getCall(0).args as any[];
        expect(args[0]).to.equal(dependent.address);
        expect(args[1]).to.equal(DEPENDENT_AMOUNT);
        expect(args[2]).to.equal(RECIPIENT);
        expect(args[3]).to.have.lengthOf(1);
        expect(args[3][0].underlying).to.equal(UNDERLYING_AMOUNT[0].underlying);
        expect(args[3][0].amount).to.equal(UNDERLYING_AMOUNT[0].amount);
      });
      then('return value from transformer is returned through registry', async () => {
        const result = await registry.callStatic.transformAllToUnderlying(dependent.address, RECIPIENT, UNDERLYING_AMOUNT, DEADLINE);
        expectObjectToBeTheSame(result, UNDERLYING_AMOUNT);
      });
    });
  });

  describe('transformAllToDependent', () => {
    assertFailsWithUnknownDependent('transformAllToDependent', () => [dependent.address, RECIPIENT, DEPENDENT_AMOUNT, DEADLINE]);
    when('dependent is registered', () => {
      const UNDERLYING_AMOUNT = BigNumber.from(123456);
      let underlyingToken: FakeContract<IERC20>;
      given(async () => {
        await registry.connect(governor).registerTransformers([{ transformer: transformer.address, dependents: [dependent.address] }]);
        underlyingToken = await smock.fake('IERC20');
        transformer.getUnderlying.returns([underlyingToken.address]);
        transformer.transformToDependent.returns(DEPENDENT_AMOUNT);
        underlyingToken.balanceOf.returns(UNDERLYING_AMOUNT);
        await registry.transformAllToDependent(dependent.address, RECIPIENT, DEPENDENT_AMOUNT, DEADLINE);
      });
      then('balance of is called correctly', async () => {
        expect(underlyingToken.balanceOf).to.have.been.calledOnceWith(signer.address);
      });
      then('delegation worked as expected', async () => {
        expect(transformer.transformToDependent).to.have.been.calledOnce.delegatedFrom(registry.address);
        const args = transformer.transformToDependent.getCall(0).args as any[];
        expect(args[0]).to.equal(dependent.address);
        expect(args[1]).to.have.lengthOf(1);
        expect(args[1][0].underlying).to.equal(underlyingToken.address);
        expect(args[1][0].amount).to.equal(UNDERLYING_AMOUNT);
        expect(args[2]).to.equal(RECIPIENT);
        expect(args[3]).to.equal(DEPENDENT_AMOUNT);
      });
      then('return value from transformer is returned through registry', async () => {
        const result = await registry.callStatic.transformAllToDependent(dependent.address, RECIPIENT, DEPENDENT_AMOUNT, DEADLINE);
        expect(result).to.equal(DEPENDENT_AMOUNT);
      });
    });
  });

  delegateTest({
    method: 'transformToExpectedUnderlying',
    args: () => [dependent.address, UNDERLYING_AMOUNT, RECIPIENT, DEPENDENT_AMOUNT, DEADLINE],
    returns: DEPENDENT_AMOUNT,
    specialArgAssertion: (args) => {
      expect(args[0]).to.equal(dependent.address);
      expect(args[1]).to.have.lengthOf(1);
      expect(args[1][0].underlying).to.equal(UNDERLYING_AMOUNT[0].underlying);
      expect(args[1][0].amount).to.equal(UNDERLYING_AMOUNT[0].amount);
      expect(args[2]).to.equal(RECIPIENT);
      expect(args[3]).to.equal(DEPENDENT_AMOUNT);
    },
  });

  delegateTest({
    method: 'transformToExpectedDependent',
    args: () => [dependent.address, DEPENDENT_AMOUNT, RECIPIENT, UNDERLYING_AMOUNT, DEADLINE],
    returns: UNDERLYING_AMOUNT as any,
    specialArgAssertion: (args) => {
      expect(args[0]).to.equal(dependent.address);
      expect(args[1]).to.equal(DEPENDENT_AMOUNT);
      expect(args[2]).to.equal(RECIPIENT);
      expect(args[3]).to.have.lengthOf(1);
      expect(args[3][0].underlying).to.equal(UNDERLYING_AMOUNT[0].underlying);
      expect(args[3][0].amount).to.equal(UNDERLYING_AMOUNT[0].amount);
    },
  });

  function delegateViewTest<Method extends keyof Functions>({
    method,
    args,
    returns,
  }: {
    method: Method;
    args: () => Parameters<Functions[Method] & TransformerRegistry['functions'][Method]>;
    returns: Arrayed<Awaited<ReturnType<Functions[Method]>>> | Awaited<ReturnType<Functions[Method]>>;
  }) {
    describe(method, () => {
      assertFailsWithUnknownDependent(method, args);
      when('dependent is registered', () => {
        given(async () => {
          await registry.connect(governor).registerTransformers([{ transformer: transformer.address, dependents: [dependent.address] }]);
          transformer[method].returns(returns);
        });
        then('return value from transformer is returned through registry', async () => {
          const result = await (registry[method] as any)(...args());
          expectObjectToBeTheSame(result, returns);
        });
      });
    });
  }

  function delegateTest<Method extends keyof Functions>({
    method,
    args,
    returns,
    specialArgAssertion,
  }: {
    method: Method;
    args: () => Parameters<Functions[Method] & TransformerRegistry['functions'][Method]>;
    returns: Arrayed<Awaited<ReturnType<Functions[Method]>>> | Awaited<ReturnType<Functions[Method]>>;
    specialArgAssertion?: (args: any[]) => void;
  }) {
    describe(method, () => {
      assertFailsWithUnknownDependent(method, args);
      when('dependent is registered', () => {
        given(async () => {
          await registry.connect(governor).registerTransformers([{ transformer: transformer.address, dependents: [dependent.address] }]);
          transformer[method].returns(returns);
        });
        then('delegation worked as expected', async () => {
          await (registry[method] as any)(...args());
          if (specialArgAssertion) {
            expect(transformer[method]).to.have.been.calledOnce.delegatedFrom(registry.address);
            const args = transformer[method].getCall(0).args as any[];
            specialArgAssertion(args);
          } else {
            expect(transformer[method])
              .to.have.been.calledOnceWith(...args())
              .delegatedFrom(registry.address);
          }
        });
        then('return value from transformer is returned through registry', async () => {
          const result = await (registry.callStatic[method] as any)(...args());
          expectObjectToBeTheSame(result, returns);
        });
      });
    });
  }

  function expectObjectToBeTheSame(actual: any, expected: any) {
    if (BigNumber.isBigNumber(actual)) {
      expect(actual).to.equal(expected);
    } else {
      if (typeof actual[0] === 'string') {
        expect(actual).to.eql(expected);
      } else {
        expect(actual.length).to.equal(expected.length);
        for (let i = 0; i < actual.length; i++) {
          expect(actual[i].underlying).to.equal(expected[i].underlying);
          expect(actual[i].amount).to.equal(expected[i].amount);
        }
      }
    }
  }

  function assertFailsWithUnknownDependent<Method extends keyof TransformerRegistry['functions']>(
    method: Method,
    getArgs: (dependent: string) => Parameters<TransformerRegistry['functions'][Method]>
  ) {
    when('trying to execute an action with an unregistered dependent', async () => {
      then('tx reverts with message', async () => {
        await behaviours.txShouldRevertWithMessage({
          contract: registry,
          func: method,
          args: [...getArgs(constants.AddressZero)],
          message: 'NoTransformerRegistered',
        });
      });
    });
  }

  type Functions = ITransformer['callStatic'];
  type Awaited<T> = T extends PromiseLike<infer U> ? U : T;
  type Arrayed<T> = T extends Array<infer U> ? U : T;

  function getInterfaceId(interface_: utils.Interface) {
    const functions = 'functions' in interface_ ? Object.keys(interface_.functions) : interface_;
    return makeInterfaceId.ERC165(functions);
  }
});
