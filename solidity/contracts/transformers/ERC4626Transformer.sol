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
  {}

  /// @inheritdoc ITransformer
  function calculateNeededToTransformToDependent(address _dependent, uint256 _expectedDependent)
    external
    view
    returns (UnderlyingAmount[] memory _neededUnderlying)
  {}

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
  ) external returns (uint256 _spentDependent) {}

  /// @inheritdoc ITransformer
  function transformToExpectedDependent(
    address _dependent,
    uint256 _expectedDependent,
    address _recipient
  ) external payable returns (UnderlyingAmount[] memory _spentUnderlying) {}

  function _toUnderlying(address _underlying) internal pure returns (address[] memory _underlyingArray) {
    _underlyingArray = new address[](1);
    _underlyingArray[0] = _underlying;
  }

  function _toUnderylingAmount(address _underlying, uint256 _amount) internal pure returns (UnderlyingAmount[] memory _amounts) {
    _amounts = new UnderlyingAmount[](1);
    _amounts[0] = UnderlyingAmount({underlying: _underlying, amount: _amount});
  }
}
