// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7 <0.9.0;

import '@openzeppelin/contracts/interfaces/IERC4626.sol';
import '@openzeppelin/contracts/interfaces/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import './BaseTransformer.sol';

/// @title An implementaton of `ITransformer` for tokens that implement `ERC4626`
contract ERC4626Transformer is BaseTransformer {
  using SafeERC20 for IERC20;

  constructor(address _governor) Governable(_governor) {}

  /// @inheritdoc ITransformer
  function getUnderlying(address _dependent) external view returns (address[] memory) {
    return _toUnderlying(IERC4626(_dependent).asset());
  }

  /// @inheritdoc ITransformer
  function calculateTransformToUnderlying(address _dependent, uint256 _amountDependent) external view returns (UnderlyingAmount[] memory) {
    address _underlying = IERC4626(_dependent).asset();
    uint256 _amount = IERC4626(_dependent).previewRedeem(_amountDependent);
    return _toUnderylingAmount(_underlying, _amount);
  }

  /// @inheritdoc ITransformer
  function calculateTransformToDependent(address _dependent, UnderlyingAmount[] calldata _underlying)
    external
    view
    returns (uint256 _amountDependent)
  {
    _amountDependent = IERC4626(_dependent).previewDeposit(_underlying[0].amount);
  }

  /// @inheritdoc ITransformer
  function calculateNeededToTransformToUnderlying(address _dependent, UnderlyingAmount[] calldata _expectedUnderlying)
    external
    view
    returns (uint256 _neededDependent)
  {
    _neededDependent = IERC4626(_dependent).previewWithdraw(_expectedUnderlying[0].amount);
  }

  /// @inheritdoc ITransformer
  function calculateNeededToTransformToDependent(address _dependent, uint256 _expectedDependent)
    external
    view
    returns (UnderlyingAmount[] memory _neededUnderlying)
  {
    address _underlying = IERC4626(_dependent).asset();
    uint256 _amount = IERC4626(_dependent).previewMint(_expectedDependent);
    return _toUnderylingAmount(_underlying, _amount);
  }

  /// @inheritdoc ITransformer
  function transformToUnderlying(
    address _dependent,
    uint256 _amountDependent,
    address _recipient
  ) external returns (UnderlyingAmount[] memory) {
    address _underlying = IERC4626(_dependent).asset();
    uint256 _amount = IERC4626(_dependent).redeem(_amountDependent, _recipient, msg.sender);
    return _toUnderylingAmount(_underlying, _amount);
  }

  /// @inheritdoc ITransformer
  function transformToDependent(
    address _dependent,
    UnderlyingAmount[] calldata _underlying,
    address _recipient
  ) external payable returns (uint256 _amountDependent) {
    IERC20 _underlyingToken = IERC20(_underlying[0].underlying);
    uint256 _underlyingAmount = _underlying[0].amount;
    // We need to take the tokens from the sender, and approve them so that the vault can take it from us
    _underlyingToken.safeTransferFrom(msg.sender, address(this), _underlyingAmount);
    _underlyingToken.approve(_dependent, _underlyingAmount);
    _amountDependent = IERC4626(_dependent).deposit(_underlyingAmount, _recipient);
  }

  /// @inheritdoc ITransformer
  function transformToExpectedUnderlying(
    address _dependent,
    UnderlyingAmount[] calldata _expectedUnderlying,
    address _recipient
  ) external returns (uint256 _spentDependent) {
    _spentDependent = IERC4626(_dependent).withdraw(_expectedUnderlying[0].amount, _recipient, msg.sender);
  }

  /// @inheritdoc ITransformer
  // slither-disable-next-line arbitrary-send
  function transformToExpectedDependent(
    address _dependent,
    uint256 _expectedDependent,
    address _recipient
  ) external payable returns (UnderlyingAmount[] memory) {
    // Check how much underlying would be needed to mint the vault tokens
    uint256 _neededUnderlying = IERC4626(_dependent).previewMint(_expectedDependent);
    // Take the needed underlying tokens from the caller, and approve the vault
    IERC20 _underlying = IERC20(IERC4626(_dependent).asset());
    _underlying.safeTransferFrom(msg.sender, address(this), _neededUnderlying);
    _underlying.approve(_dependent, _neededUnderlying);
    // Mint the vault tokens
    uint256 _spentUnderlying = IERC4626(_dependent).mint(_expectedDependent, _recipient);
    // If some tokens were left unspent, then return to caller
    if (_spentUnderlying < _neededUnderlying) {
      _underlying.transfer(msg.sender, _neededUnderlying - _spentUnderlying);
    }
    return _toUnderylingAmount(address(_underlying), _spentUnderlying);
  }

  function _toUnderlying(address _underlying) internal pure returns (address[] memory _underlyingArray) {
    _underlyingArray = new address[](1);
    _underlyingArray[0] = _underlying;
  }

  function _toUnderylingAmount(address _underlying, uint256 _amount) internal pure returns (UnderlyingAmount[] memory _amounts) {
    _amounts = new UnderlyingAmount[](1);
    _amounts[0] = UnderlyingAmount({underlying: _underlying, amount: _amount});
  }
}
