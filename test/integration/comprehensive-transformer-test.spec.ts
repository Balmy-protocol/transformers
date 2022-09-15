import { deployments, ethers, getNamedAccounts } from 'hardhat';
import { evm, wallet } from '@utils';
import { contract, given, then, when } from '@utils/bdd';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  IERC20,
  BaseTransformer,
  ITransformer,
  ITransformer__factory,
  IERC20__factory,
  IERC165__factory,
  ICollectableDust__factory,
  IMulticall__factory,
  IGovernable__factory,
  TransformerRegistry,
} from '@typechained';
import { BigNumber, BigNumberish, constants, utils } from 'ethers';
import { abi as IERC20_ABI } from '@openzeppelin/contracts/build/contracts/IERC20.json';
import { DeterministicFactory, DeterministicFactory__factory } from '@mean-finance/deterministic-factory';
import { snapshot } from '@utils/evm';
import { JsonRpcSigner } from '@ethersproject/providers';
const { makeInterfaceId } = require('@openzeppelin/test-helpers');

const BLOCK_NUMBER = 15014793;

const PROTOCOL_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

const TOKENS = {
  'cvxCRVCRV Vault': {
    address: '0xB78eBb2248bB72380E690246F9631Cf58c07B444',
    whale: '0x58c8087ef758df6f6b3dc045cf135c850a8307b6',
  },
  cvxCRVCRV: {
    address: '0x9d0464996170c6b9e75eed71c68b99ddedf279e8',
    whale: '0x903da6213a5a12b61c821598154efad98c3b20e4',
  },
  WETH: {
    address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    whale: '0x030ba81f1c18d280636f32af80b9aad02cf0854e',
  },
  ETH: {
    address: PROTOCOL_TOKEN,
  },
};

describe('Comprehensive Transformer Test', () => {
  let signer: SignerWithAddress;

  before(async () => {
    [, signer] = await ethers.getSigners();
  });

  transformerComprehensiveTest({
    transformer: 'ERC4626Transformer',
    dependent: 'cvxCRVCRV Vault',
    underlying: ['cvxCRVCRV'],
  });

  transformerComprehensiveTest({
    transformer: 'ProtocolTokenWrapperTransformer',
    dependent: 'WETH',
    underlying: ['ETH'],
  });

  transformerComprehensiveTest({
    transformer: 'TransformerRegistry',
    dependent: 'WETH',
    underlying: ['ETH'],
    transformerDependencies: ['ProtocolTokenWrapperTransformer'],
    setup: (registry, governor, [transformer]) =>
      (registry as any as TransformerRegistry)
        .connect(governor)
        .registerTransformers([{ transformer: transformer.address, dependents: [TOKENS['WETH'].address] }]),
  });

  function transformerComprehensiveTest({
    transformer: transformerName,
    title,
    dependent: dependentId,
    underlying: underlyingIds,
    transformerDependencies,
    setup,
  }: {
    title?: string;
    transformer: string;
    dependent: keyof typeof TOKENS;
    underlying: (keyof typeof TOKENS)[];
    transformerDependencies?: string[];
    setup?: (transformer: BaseTransformer, governor: JsonRpcSigner, dependencies: BaseTransformer[]) => Promise<any>;
  }) {
    contract(title ?? transformerName, () => {
      const INITIAL_SIGNER_BALANCE = utils.parseEther('10');
      const RECIPIENT = '0x00000000000000000000000000000000000000FF';
      let governor: JsonRpcSigner;
      let dependent: IERC20Like, underlying: IERC20Like[];
      let transformer: BaseTransformer;
      let snapshotId: string, resetBalancesSnapshot: string;
      before(async () => {
        await fork({ chain: 'ethereum', blockNumber: BLOCK_NUMBER });

        // Deploy transformer
        await deployments.run([transformerName, ...(transformerDependencies ?? [])], {
          resetMemory: true,
          deletePreviousDeployments: false,
          writeDeploymentsToFiles: false,
        });
        transformer = await ethers.getContract<BaseTransformer>(transformerName);

        // Set governor
        governor = await wallet.impersonate(await transformer.governor());
        await ethers.provider.send('hardhat_setBalance', [governor._address, '0xffffffffffffffff']);

        // Set up transformer
        const dependencies = await Promise.all(
          transformerDependencies?.map((transformerName) => ethers.getContract<BaseTransformer>(transformerName)) ?? []
        );
        await setup?.(transformer, governor, dependencies);

        // Take snapshot
        resetBalancesSnapshot = await snapshot.take();

        // Sent tokens from whales to signer
        const tokens: IERC20Like[] = [];
        for (const tokenId of [dependentId, ...underlyingIds]) {
          const tokenData = TOKENS[tokenId];
          const token = await wrap(tokenData.address);
          if ('whale' in tokenData) {
            const whale = await wallet.impersonate(tokenData.whale);
            await ethers.provider.send('hardhat_setBalance', [whale._address, '0xffffffffffffffff']);
            await token.connect(whale).transfer(signer.address, INITIAL_SIGNER_BALANCE);
          } else {
            await ethers.provider.send('hardhat_setBalance', [signer.address, utils.hexStripZeros(INITIAL_SIGNER_BALANCE.toHexString())]);
          }
          tokens.push(token);
        }
        [dependent, ...underlying] = tokens;

        // Take snapshot
        snapshotId = await snapshot.take();
      });
      beforeEach(async () => {
        await snapshot.revert(snapshotId);
      });
      after(async () => {
        await snapshot.revert(resetBalancesSnapshot);
      });
      describe('getUnderlying', () => {
        when('asked for the underlying tokens', () => {
          then('the correct addresses are returned', async () => {
            const underlyingTokens = await transformer.getUnderlying(dependent.address);
            expect(underlyingTokens.length).to.equal(underlying.length);
            for (const underlyingToken of underlyingTokens) {
              expect(isTokenUnderyling(underlyingToken)).to.be.true;
            }
          });
        });
      });
      describe('calculateTransformToUnderlying', () => {
        const AMOUNT_DEPENDENT = utils.parseEther('1');
        when('calculating the transformation to underlying', () => {
          let returnedUnderlying: ITransformer.UnderlyingAmountStructOutput[];
          given(async () => {
            returnedUnderlying = await transformer.calculateTransformToUnderlying(dependent.address, AMOUNT_DEPENDENT);
          });
          then('all underlying tokens are part of the result', () => {
            expect(returnedUnderlying.length).to.equal(underlying.length);
            for (const { underlying: underlyingToken } of returnedUnderlying) {
              expect(isTokenUnderyling(underlyingToken)).to.be.true;
            }
          });
          then('transforming back to dependent returns the same value', async () => {
            // Note: this test assumes that there is no transform fee
            expect(await transformer.calculateTransformToDependent(dependent.address, returnedUnderlying)).to.equal(AMOUNT_DEPENDENT);
          });
        });
      });
      describe('calculateTransformToDependent', () => {
        const AMOUNT_PER_UNDERLYING = utils.parseEther('1');
        when('calculating the transformation to dependent', () => {
          let returnedDependent: BigNumber;
          given(async () => {
            const input = underlying.map((underlying) => ({ underlying: underlying.address, amount: AMOUNT_PER_UNDERLYING }));
            returnedDependent = await transformer.calculateTransformToDependent(dependent.address, input);
          });
          then('transforming back to underlying returns the same value', async () => {
            // Note: this test assumes that there is no transform fee
            const returnedUnderlying = await transformer.calculateTransformToUnderlying(dependent.address, returnedDependent);
            expect(returnedUnderlying.length).to.equal(underlying.length);
            for (const { underlying: underlyingToken, amount } of returnedUnderlying) {
              expect(isTokenUnderyling(underlyingToken)).to.be.true;
              expect(amount).to.equal(AMOUNT_PER_UNDERLYING);
            }
          });
        });
      });
      describe('calculateNeededToTransformToUnderlying', () => {
        const AMOUNT_PER_UNDERLYING = utils.parseEther('1');
        when('calculating how much is needed to transform to underlying', () => {
          let neededDependent: BigNumber;
          given(async () => {
            const input = underlying.map((underlying) => ({ underlying: underlying.address, amount: AMOUNT_PER_UNDERLYING }));
            neededDependent = await transformer.calculateNeededToTransformToUnderlying(dependent.address, input);
          });
          then('then transforming the result returns the expected underlying', async () => {
            // Note: this test assumes that there is no transform fee
            const returnedUnderlying = await transformer.calculateTransformToUnderlying(dependent.address, neededDependent);
            expect(returnedUnderlying.length).to.equal(underlying.length);
            for (const { underlying: underlyingToken, amount } of returnedUnderlying) {
              expect(isTokenUnderyling(underlyingToken)).to.be.true;
              expect(amount).to.equal(AMOUNT_PER_UNDERLYING);
            }
          });
        });
      });
      describe('calculateNeededToTransformToDependent', () => {
        const AMOUNT_DEPENDENT = utils.parseEther('1');
        when('calculating how much is needed to transform to dependent', () => {
          let neededUnderlying: ITransformer.UnderlyingAmountStructOutput[];
          given(async () => {
            neededUnderlying = await transformer.calculateNeededToTransformToDependent(dependent.address, AMOUNT_DEPENDENT);
          });
          then('all underlying tokens are part of the result', () => {
            expect(neededUnderlying.length).to.equal(underlying.length);
            for (const { underlying: underlyingToken } of neededUnderlying) {
              expect(isTokenUnderyling(underlyingToken)).to.be.true;
            }
          });
          then('then transforming the result returns the expected underlying', async () => {
            // Note: this test assumes that there is no transform fee
            expect(await transformer.calculateTransformToDependent(dependent.address, neededUnderlying)).to.equal(AMOUNT_DEPENDENT);
          });
        });
      });
      describe('transformToUnderlying', () => {
        const AMOUNT_DEPENDENT = utils.parseEther('1');
        when('transforming to underlying', () => {
          let expectedUnderlying: ITransformer.UnderlyingAmountStructOutput[];
          given(async () => {
            await dependent.connect(signer).approve(transformer.address, AMOUNT_DEPENDENT);
            expectedUnderlying = await transformer.calculateTransformToUnderlying(dependent.address, AMOUNT_DEPENDENT);
            await transformer.connect(signer).transformToUnderlying(dependent.address, AMOUNT_DEPENDENT, RECIPIENT, expectedUnderlying);
          });
          then('allowance is spent', async () => {
            expect(await dependent.allowance(signer.address, transformer.address)).to.equal(0);
          });
          then('dependent tokens are transferred', async () => {
            const balance = await dependent.balanceOf(signer.address);
            expect(balance).to.equal(INITIAL_SIGNER_BALANCE.sub(AMOUNT_DEPENDENT));
          });
          then('underlying tokens are sent to the recipient', async () => {
            for (const { underlying, amount } of expectedUnderlying) {
              const token = await wrap(underlying);
              const recipientBalance = await token.balanceOf(RECIPIENT);
              expect(recipientBalance).to.equal(amount);
            }
          });
        });
      });
      describe('transformToDependent', () => {
        const AMOUNT_PER_UNDERLYING = utils.parseEther('1');
        when('transforming to dependent', () => {
          let expectedDependent: BigNumber;
          let gasSpent: BigNumber;
          given(async () => {
            const input = underlying.map((token) => ({ underlying: token.address, amount: AMOUNT_PER_UNDERLYING }));
            const value = isTokenUnderyling(PROTOCOL_TOKEN) ? AMOUNT_PER_UNDERLYING : constants.Zero;
            for (const underlyingToken of underlying) {
              await underlyingToken.connect(signer).approve(transformer.address, AMOUNT_PER_UNDERLYING);
            }
            expectedDependent = await transformer.calculateTransformToDependent(dependent.address, input);
            const tx = await transformer.connect(signer).transformToDependent(dependent.address, input, RECIPIENT, expectedDependent, { value });
            const { gasUsed, effectiveGasPrice } = await tx.wait();
            gasSpent = gasUsed.mul(effectiveGasPrice);
          });
          then('allowance is spent for all underlying tokens', async () => {
            for (const underlyingToken of underlying) {
              expect(await underlyingToken.allowance(signer.address, transformer.address)).to.equal(0);
            }
          });
          then('underlying tokens are transferred', async () => {
            for (const underlyingToken of underlying) {
              const balance = await underlyingToken.balanceOf(signer.address);
              if (underlyingToken.address === PROTOCOL_TOKEN) {
                expect(balance).to.equal(INITIAL_SIGNER_BALANCE.sub(AMOUNT_PER_UNDERLYING).sub(gasSpent));
              } else {
                expect(balance).to.equal(INITIAL_SIGNER_BALANCE.sub(AMOUNT_PER_UNDERLYING));
              }
            }
          });
          then('dependent tokens are sent to the recipient', async () => {
            const recipientBalance = await dependent.balanceOf(RECIPIENT);
            expect(recipientBalance).to.equal(expectedDependent);
          });
        });
      });
      describe('transformToExpectedUnderlying', () => {
        const AMOUNT_PER_UNDERLYING = utils.parseEther('1');
        when('transforming to an expected amount of underlying', () => {
          let neededDependent: BigNumber;
          given(async () => {
            const input = underlying.map((token) => ({ underlying: token.address, amount: AMOUNT_PER_UNDERLYING }));
            neededDependent = await transformer.calculateNeededToTransformToUnderlying(dependent.address, input);
            await dependent.connect(signer).approve(transformer.address, neededDependent);
            await transformer.connect(signer).transformToExpectedUnderlying(dependent.address, input, RECIPIENT, neededDependent);
          });
          then('allowance is spent', async () => {
            expect(await dependent.allowance(signer.address, transformer.address)).to.equal(0);
          });
          then('dependent tokens are transferred', async () => {
            const balance = await dependent.balanceOf(signer.address);
            expect(balance).to.equal(INITIAL_SIGNER_BALANCE.sub(neededDependent));
          });
          then('expected underlying tokens are sent to the recipient', async () => {
            for (const underlyingToken of underlying) {
              const recipientBalance = await underlyingToken.balanceOf(RECIPIENT);
              expect(recipientBalance).to.equal(AMOUNT_PER_UNDERLYING);
            }
          });
        });
      });
      describe('transformToExpectedDependent', () => {
        const AMOUNT_DEPENDENT = utils.parseEther('1');
        when('transforming to an expected amount of dependent', () => {
          let neededUnderlying: ITransformer.UnderlyingAmountStructOutput[];
          let gasSpent: BigNumber;
          given(async () => {
            neededUnderlying = await transformer.calculateNeededToTransformToDependent(dependent.address, AMOUNT_DEPENDENT);
            for (const { underlying, amount } of neededUnderlying) {
              const underlyingToken = await wrap(underlying);
              await underlyingToken.connect(signer).approve(transformer.address, amount);
            }
            const value = isTokenUnderyling(PROTOCOL_TOKEN) ? neededUnderlying[0].amount : constants.Zero;
            const tx = await transformer
              .connect(signer)
              .transformToExpectedDependent(dependent.address, AMOUNT_DEPENDENT, RECIPIENT, neededUnderlying, { value });
            const { gasUsed, effectiveGasPrice } = await tx.wait();
            gasSpent = gasUsed.mul(effectiveGasPrice);
          });
          then('allowance is spent', async () => {
            expect(await dependent.allowance(signer.address, transformer.address)).to.equal(0);
          });
          then('underlying tokens are transferred', async () => {
            for (const { underlying, amount } of neededUnderlying) {
              const underlyingToken = await wrap(underlying);
              const balance = await underlyingToken.balanceOf(signer.address);
              if (underlyingToken.address === PROTOCOL_TOKEN) {
                expect(balance).to.equal(INITIAL_SIGNER_BALANCE.sub(amount).sub(gasSpent));
              } else {
                expect(balance).to.equal(INITIAL_SIGNER_BALANCE.sub(amount));
              }
            }
          });
          then('expected dependent tokens are sent to the recipient', async () => {
            const recipientBalance = await dependent.balanceOf(RECIPIENT);
            expect(recipientBalance).to.equal(AMOUNT_DEPENDENT);
          });
        });
      });
      describe('sendDust', () => {
        const RECIPIENT = wallet.generateRandomAddress();
        when('sending protocol token dust', () => {
          const INITIAL_DUST_BALANCE = utils.parseEther('1');
          const DUST_TO_COLLECT = utils.parseEther('0.1');
          given(async () => {
            const balanceHex = utils.hexStripZeros(INITIAL_DUST_BALANCE.toHexString());
            await ethers.provider.send('hardhat_setBalance', [transformer.address, balanceHex]);
            await transformer.connect(governor).sendDust(await transformer.PROTOCOL_TOKEN(), DUST_TO_COLLECT, RECIPIENT);
          });
          then('protocol token is collected from contract', async () => {
            expect(await ethers.provider.getBalance(transformer.address)).to.equal(INITIAL_DUST_BALANCE.sub(DUST_TO_COLLECT));
          });
          then('protocol token is sent to recipient', async () => {
            expect(await ethers.provider.getBalance(RECIPIENT)).to.equal(DUST_TO_COLLECT);
          });
        });
        context('sending erc20 dust', () => {
          const INITIAL_DUST_BALANCE = utils.parseEther('1');
          const DUST_TO_COLLECT = utils.parseEther('0.1');
          given(async () => {
            await dependent.connect(signer).transfer(transformer.address, INITIAL_DUST_BALANCE);
            await transformer.connect(governor).sendDust(dependent.address, DUST_TO_COLLECT, RECIPIENT);
          });
          then('erc20 is collected from contract', async () => {
            expect(await dependent.balanceOf(transformer.address)).to.equal(INITIAL_DUST_BALANCE.sub(DUST_TO_COLLECT));
          });
          then('erc20 is sent to recipient', async () => {
            expect(await dependent.balanceOf(RECIPIENT)).to.equal(DUST_TO_COLLECT);
          });
        });
      });
      describe('multicall', () => {
        when('asking calculating transform using multicall', () => {
          const AMOUNT_PER_UNDERLYING = utils.parseEther('1');
          let returnedDependent1: BigNumber, returnedDependent2: BigNumber;
          given(async () => {
            const input = underlying.map((underlying) => ({ underlying: underlying.address, amount: AMOUNT_PER_UNDERLYING }));
            const { data } = await transformer.populateTransaction.calculateTransformToDependent(dependent.address, input);
            const [result1, result2] = await transformer.callStatic.multicall([data!, data!]);
            returnedDependent1 = BigNumber.from(result1);
            returnedDependent2 = BigNumber.from(result2);
          });
          then('both returned values are the same', async () => {
            expect(returnedDependent1).to.equal(returnedDependent2);
          });
          then('transforming back to underlying returns the same value', async () => {
            // Note: this test assumes that there is no transform fee
            const returnedUnderlying = await transformer.calculateTransformToUnderlying(dependent.address, returnedDependent1);
            expect(returnedUnderlying.length).to.equal(underlying.length);
            for (const { underlying: underlyingToken, amount } of returnedUnderlying) {
              expect(isTokenUnderyling(underlyingToken)).to.be.true;
              expect(amount).to.equal(AMOUNT_PER_UNDERLYING);
            }
          });
        });
      });
      describe('supportsInterface', () => {
        isInterfaceSupportedTest({
          name: 'IERC165',
          interface_: IERC165__factory.createInterface(),
          expected: true,
        });
        isInterfaceSupportedTest({
          name: 'ITransformer',
          interface_: ITransformer__factory.createInterface(),
          expected: true,
        });
        isInterfaceSupportedTest({
          name: 'ICollectableDust',
          interface_: ICollectableDust__factory.createInterface(),
          expected: true,
        });
        isInterfaceSupportedTest({
          name: 'IMulticall',
          interface_: IMulticall__factory.createInterface(),
          expected: true,
        });
        isInterfaceSupportedTest({
          name: 'IGovernable',
          interface_: IGovernable__factory.createInterface(),
          expected: true,
        });
        isInterfaceSupportedTest({
          name: 'IERC20',
          interface_: IERC20__factory.createInterface(),
          expected: false,
        });
        function isInterfaceSupportedTest({ name, interface_, expected }: { name: string; interface_: utils.Interface; expected: boolean }) {
          when(`asked if ${name} is supported`, () => {
            then('result is as expected', async () => {
              const functions = Object.keys(interface_.functions);
              const interfaceId = makeInterfaceId.ERC165(functions);
              expect(await transformer.supportsInterface(interfaceId)).to.equal(expected);
            });
          });
        }
      });
      function isTokenUnderyling(token: string) {
        const underlyingTokens = underlying.map(({ address }) => address.toLowerCase());
        return underlyingTokens.includes(token.toLowerCase());
      }
    });
  }

  async function wrap(token: string): Promise<IERC20Like> {
    return token === PROTOCOL_TOKEN ? ethWrapper() : await ethers.getContractAt<IERC20>(IERC20_ABI, token);
  }

  function ethWrapper(): IERC20Like {
    const wrapper: IERC20Like = {
      address: TOKENS['ETH'].address,
      balanceOf: (address) => ethers.provider.getBalance(address),
      approve: () => Promise.resolve(),
      allowance: () => Promise.resolve(constants.Zero),
      transfer: () => Promise.resolve(),
      connect: () => wrapper,
    };
    return wrapper;
  }

  type IERC20Like = {
    balanceOf: (address: string) => Promise<BigNumber>;
    approve: (address: string, amount: BigNumberish) => Promise<any>;
    transfer: (address: string, amount: BigNumberish) => Promise<any>;
    address: string;
    allowance: (owner: string, spender: string) => Promise<BigNumber>;
    connect: (signer: SignerWithAddress | JsonRpcSigner) => IERC20Like;
  };

  async function fork({ chain, blockNumber }: { chain: string; blockNumber?: number }): Promise<void> {
    // Set fork of network
    await evm.reset({
      network: chain,
      blockNumber,
    });

    const { deployer, eoaAdmin } = await getNamedAccounts();
    // Give deployer role to our deployer address
    const admin = await wallet.impersonate(eoaAdmin);
    await wallet.setBalance({ account: admin._address, balance: constants.MaxUint256 });
    const deterministicFactory = await ethers.getContractAt<DeterministicFactory>(
      DeterministicFactory__factory.abi,
      '0xbb681d77506df5CA21D2214ab3923b4C056aa3e2'
    );
    await deterministicFactory.connect(admin).grantRole(await deterministicFactory.DEPLOYER_ROLE(), deployer);
  }
});
