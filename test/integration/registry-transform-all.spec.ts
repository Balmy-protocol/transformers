import { deployments, ethers, getNamedAccounts } from 'hardhat';
import { evm, wallet } from '@utils';
import { given, then, when } from '@utils/bdd';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { IERC20, BaseTransformer, ITransformer, TransformerRegistry } from '@typechained';
import { BigNumber, constants, utils } from 'ethers';
import { abi as IERC20_ABI } from '@openzeppelin/contracts/build/contracts/IERC20.json';
import { DeterministicFactory, DeterministicFactory__factory } from '@mean-finance/deterministic-factory';
import { address as DETERMINISTIC_FACTORY_ADDRESS } from '@mean-finance/deterministic-factory/deployments/ethereum/DeterministicFactory.json';
import { snapshot } from '@utils/evm';

const BLOCK_NUMBER = 15583285;

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
  },
};

describe('Transformer Registry - Transform All', () => {
  const INITIAL_DEPENDENT_BALANCE = utils.parseEther('10');
  const INITIAL_UNDERLYING_BALANCE = utils.parseEther('10');
  const RECIPIENT = '0x00000000000000000000000000000000000000FF';

  let signer: SignerWithAddress;
  let dependent: IERC20, underlying: IERC20;
  let registry: TransformerRegistry;
  let snapshotId: string;

  before(async () => {
    [, signer] = await ethers.getSigners();
    await fork({ chain: 'ethereum', blockNumber: BLOCK_NUMBER });

    // Deploy transformer
    await deployments.fixture(['TransformerRegistry', 'ERC4626Transformer', 'ProtocolTokenWrapperTransformer'], {
      keepExistingDeployments: false,
    });
    registry = await ethers.getContract<TransformerRegistry>('TransformerRegistry');
    const erc4626Transformer = await ethers.getContract<BaseTransformer>('ERC4626Transformer');
    const nativeTokenTransformer = await ethers.getContract<BaseTransformer>('ProtocolTokenWrapperTransformer');

    // Set governor
    const governor = await wallet.impersonate(await registry.governor());
    await ethers.provider.send('hardhat_setBalance', [governor._address, '0xffffffffffffffff']);

    // Load tokens
    dependent = await ethers.getContractAt<IERC20>(IERC20_ABI, TOKENS['cvxCRVCRV Vault'].address);
    underlying = await ethers.getContractAt<IERC20>(IERC20_ABI, TOKENS['cvxCRVCRV'].address);

    // Register transformer
    await registry.connect(governor).registerTransformers([
      { transformer: erc4626Transformer.address, dependents: [dependent.address] },
      { transformer: nativeTokenTransformer.address, dependents: [TOKENS['WETH'].address] },
    ]);

    // Sent tokens from whales to signer
    const dependentWhale = await wallet.impersonate(TOKENS['cvxCRVCRV Vault'].whale);
    const underlyingWhale = await wallet.impersonate(TOKENS['cvxCRVCRV'].whale);
    await ethers.provider.send('hardhat_setBalance', [dependentWhale._address, '0xffffffffffffffff']);
    await ethers.provider.send('hardhat_setBalance', [underlyingWhale._address, '0xffffffffffffffff']);
    await dependent.connect(dependentWhale).transfer(signer.address, INITIAL_DEPENDENT_BALANCE);
    await underlying.connect(underlyingWhale).transfer(signer.address, INITIAL_UNDERLYING_BALANCE);

    // Take snapshot
    snapshotId = await snapshot.take();
  });

  beforeEach(async () => {
    await snapshot.revert(snapshotId);
  });

  describe('transformAllToUnderlying', () => {
    when('transforming all to underlying', () => {
      let expectedUnderlying: ITransformer.UnderlyingAmountStructOutput[];
      given(async () => {
        await dependent.connect(signer).approve(registry.address, INITIAL_DEPENDENT_BALANCE);
        expectedUnderlying = await registry.calculateTransformToUnderlying(dependent.address, INITIAL_DEPENDENT_BALANCE);
        await registry.connect(signer).transformAllToUnderlying(dependent.address, RECIPIENT, expectedUnderlying, constants.MaxUint256);
      });
      then('allowance is spent', async () => {
        expect(await dependent.allowance(signer.address, registry.address)).to.equal(0);
      });
      then('all dependent tokens are transferred', async () => {
        const balance = await dependent.balanceOf(signer.address);
        expect(balance).to.equal(0);
      });
      then('underlying tokens are sent to the recipient', async () => {
        const recipientBalance = await underlying.balanceOf(RECIPIENT);
        expect(recipientBalance).to.equal(expectedUnderlying[0].amount);
      });
    });
  });
  describe('transformAllToDependent', () => {
    when('transforming to dependent', () => {
      let expectedDependent: BigNumber;
      given(async () => {
        await underlying.connect(signer).approve(registry.address, INITIAL_UNDERLYING_BALANCE);
        expectedDependent = await registry.calculateTransformToDependent(dependent.address, [
          { underlying: underlying.address, amount: INITIAL_UNDERLYING_BALANCE },
        ]);
        await registry.connect(signer).transformAllToDependent(dependent.address, RECIPIENT, expectedDependent, constants.MaxUint256);
      });
      then('allowance is spent for all underlying tokens', async () => {
        expect(await underlying.allowance(signer.address, registry.address)).to.equal(0);
      });
      then('all underlying tokens are transferred', async () => {
        const balance = await underlying.balanceOf(signer.address);
        expect(balance).to.equal(0);
      });
      then('dependent tokens are sent to the recipient', async () => {
        const recipientBalance = await dependent.balanceOf(RECIPIENT);
        expect(recipientBalance).to.equal(expectedDependent);
      });
    });
    when('transforming all ETH to dependent', () => {
      const AMOUNT = utils.parseEther('1');
      let WETH: IERC20;
      given(async () => {
        WETH = await ethers.getContractAt<IERC20>(IERC20_ABI, TOKENS['WETH'].address);
        await registry.connect(signer).transformAllToDependent(WETH.address, RECIPIENT, AMOUNT, constants.MaxUint256, { value: AMOUNT });
      });
      then('all underlying tokens are transformed', async () => {
        const balance = await ethers.provider.getBalance(registry.address);
        expect(balance).to.equal(0);
      });
      then('dependent tokens are sent to the recipient', async () => {
        const recipientBalance = await WETH.balanceOf(RECIPIENT);
        expect(recipientBalance).to.equal(AMOUNT);
      });
    });
  });

  async function fork({ chain, blockNumber }: { chain: string; blockNumber?: number }): Promise<void> {
    // Set fork of network
    await evm.reset({
      network: chain,
      blockNumber,
    });

    const { deployer, msig } = await getNamedAccounts();
    const admin = await wallet.impersonate(msig);
    await wallet.setBalance({ account: admin._address, balance: constants.MaxUint256 });
    const deterministicFactory = await ethers.getContractAt<DeterministicFactory>(
      DeterministicFactory__factory.abi,
      DETERMINISTIC_FACTORY_ADDRESS
    );
    // Give deployer role to our deployer address
    await deterministicFactory.connect(admin).grantRole(await deterministicFactory.DEPLOYER_ROLE(), deployer);
  }
});
