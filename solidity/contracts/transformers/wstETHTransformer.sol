// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7 <0.9.0;

import '@openzeppelin/contracts/interfaces/IERC20.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import './BaseTransformer.sol';

/// @title An implementaton of `ITransformer` for wstETH <=> stETH
contract wstETHTransformer is BaseTransformer {
  using SafeERC20 for IwstETH;
  using SafeERC20 for IstETH;

  /// @notice The address of the stETH contract
  IstETH public immutable stETH;

  constructor(IstETH _stETH, address _governor) Governable(_governor) {
    stETH = _stETH;
  }

  /// @inheritdoc ITransformer
  function getUnderlying(address) external view returns (address[] memory) {
    return _toSingletonArray(stETH);
  }

  /// @inheritdoc ITransformer
  function calculateTransformToUnderlying(address, uint256 _amountDependent) external view returns (UnderlyingAmount[] memory) {
    uint256 _amountUnderlying = stETH.getPooledEthByShares(_amountDependent);
    return _toSingletonArray(stETH, _amountUnderlying);
  }

  /// @inheritdoc ITransformer
  function calculateTransformToDependent(address, UnderlyingAmount[] calldata _underlying) external view returns (uint256 _amountDependent) {
    if (_underlying.length != 1) revert InvalidUnderlyingInput();
    _amountDependent = stETH.getSharesByPooledEth(_underlying[0].amount);
  }

  /// @inheritdoc ITransformer
  function calculateNeededToTransformToUnderlying(address, UnderlyingAmount[] calldata _expectedUnderlying)
    external
    view
    returns (uint256 _neededDependent)
  {
    if (_expectedUnderlying.length != 1) revert InvalidUnderlyingInput();
    _neededDependent = _calculateNeededToTransformToUnderlying(_expectedUnderlying[0].amount);
  }

  /// @inheritdoc ITransformer
  function calculateNeededToTransformToDependent(address, uint256 _expectedDependent)
    external
    view
    returns (UnderlyingAmount[] memory _neededUnderlying)
  {
    uint256 _neededUnderlyingAmount = _calculateNeededToTransformToDependent(_expectedDependent);
    return _toSingletonArray(stETH, _neededUnderlyingAmount);
  }

  /// @inheritdoc ITransformer
  function transformToUnderlying(
    address _dependent,
    uint256 _amountDependent,
    address _recipient,
    UnderlyingAmount[] calldata _minAmountOut,
    uint256 _deadline
  ) external payable checkDeadline(_deadline) returns (UnderlyingAmount[] memory) {}

  /// @inheritdoc ITransformer
  function transformToDependent(
    address _dependent,
    UnderlyingAmount[] calldata _underlying,
    address _recipient,
    uint256 _minAmountOut,
    uint256 _deadline
  ) external payable checkDeadline(_deadline) returns (uint256 _amountDependent) {}

  /// @inheritdoc ITransformer
  function transformToExpectedUnderlying(
    address _dependent,
    UnderlyingAmount[] calldata _expectedUnderlying,
    address _recipient,
    uint256 _maxAmountIn,
    uint256 _deadline
  ) external payable checkDeadline(_deadline) returns (uint256 _spentDependent) {}

  /// @inheritdoc ITransformer
  function transformToExpectedDependent(
    address _dependent,
    uint256 _expectedDependent,
    address _recipient,
    UnderlyingAmount[] calldata _maxAmountIn,
    uint256 _deadline
  ) external payable checkDeadline(_deadline) returns (UnderlyingAmount[] memory _spentUnderlying) {}

  function _calculateNeededToTransformToUnderlying(uint256 _expectedUnderlying) internal view returns (uint256 _neededDependent) {
    // Since stETH contracts rounds down, we do the math here and round up
    uint256 _totalSuppy = stETH.totalSupply();
    uint256 _totalShares = stETH.getTotalShares();
    _neededDependent = Math.mulDiv(_expectedUnderlying, _totalShares, _totalSuppy, Math.Rounding.Up);
  }

  function _calculateNeededToTransformToDependent(uint256 _expectedDependent) internal view returns (uint256 _neededUnderlying) {
    // Since stETH contracts rounds down, we do the math here and round up
    uint256 _totalShares = stETH.getTotalShares();
    uint256 _totalSuppy = stETH.totalSupply();
    _neededUnderlying = Math.mulDiv(_expectedDependent, _totalSuppy, _totalShares, Math.Rounding.Up);
  }

  function _toSingletonArray(IstETH _underlying) internal pure returns (address[] memory _underlyingArray) {
    _underlyingArray = new address[](1);
    _underlyingArray[0] = address(_underlying);
  }

  function _toSingletonArray(IstETH _underlying, uint256 _amount) internal pure returns (UnderlyingAmount[] memory _amounts) {
    _amounts = new UnderlyingAmount[](1);
    _amounts[0] = UnderlyingAmount({underlying: address(_underlying), amount: _amount});
  }
}

interface IstETH is IERC20 {
  /**
   * @return The total amount of stETH
   */
  function totalSupply() external view returns (uint256);

  /**
   * @return The total amount of internal shares on stETH
   * @dev This has nothing to do with wstETH supply
   */
  function getTotalShares() external view returns (uint256);

  /**
   * @return The amount of Ether that corresponds to `sharesAmount` token shares.
   */
  function getPooledEthByShares(uint256 sharesAmount) external view returns (uint256);

  /**
   * @return The amount of shares that corresponds to `stEthAmount` protocol-controlled Ether.
   */
  function getSharesByPooledEth(uint256 ethAmount) external view returns (uint256);
}

interface IwstETH is IERC20 {
  /**
   * @notice Exchanges stETH to wstETH
   * @param _stETHAmount amount of stETH to wrap in exchange for wstETH
   * @dev Requirements:
   *  - `_stETHAmount` must be non-zero
   *  - msg.sender must approve at least `_stETHAmount` stETH to this
   *    contract.
   *  - msg.sender must have at least `_stETHAmount` of stETH.
   * User should first approve _stETHAmount to the WstETH contract
   * @return Amount of wstETH user receives after wrap
   */
  function wrap(uint256 _stETHAmount) external returns (uint256);

  /**
   * @notice Exchanges wstETH to stETH
   * @param _wstETHAmount amount of wstETH to uwrap in exchange for stETH
   * @dev Requirements:
   *  - `_wstETHAmount` must be non-zero
   *  - msg.sender must have at least `_wstETHAmount` wstETH.
   * @return Amount of stETH user receives after unwrap
   */
  function unwrap(uint256 _wstETHAmount) external returns (uint256);
}
