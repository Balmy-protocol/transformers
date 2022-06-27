// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7 <0.9.0;

import '@openzeppelin/contracts/interfaces/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/introspection/ERC165Checker.sol';
import './transformers/BaseTransformer.sol';
import '../interfaces/ITransformerRegistry.sol';

contract TransformerRegistry is BaseTransformer, ITransformerRegistry {
  mapping(address => ITransformer) internal _registeredTransformer; // dependent => transformer

  constructor(address _governor) Governable(_governor) {}

  /// @inheritdoc ITransformerRegistry
  function transformers(address[] calldata _dependents) external view returns (ITransformer[] memory _transformers) {
    _transformers = new ITransformer[](_dependents.length);
    for (uint256 i; i < _dependents.length; i++) {
      _transformers[i] = _registeredTransformer[_dependents[i]];
    }
  }

  /// @inheritdoc ITransformerRegistry
  function registerTransformers(TransformerRegistration[] calldata _registrations) external onlyGovernor {
    for (uint256 i; i < _registrations.length; i++) {
      TransformerRegistration memory _registration = _registrations[i];
      // Make sure the given address is actually a transformer
      bool _isTransformer = ERC165Checker.supportsInterface(_registration.transformer, type(ITransformer).interfaceId);
      if (!_isTransformer) revert AddressIsNotTransformer(_registration.transformer);
      for (uint256 j; j < _registration.dependents.length; j++) {
        _registeredTransformer[_registration.dependents[j]] = ITransformer(_registration.transformer);
      }
    }
    emit TransformersRegistered(_registrations);
  }

  /// @inheritdoc ITransformer
  function getUnderlying(address _dependent) external view returns (address[] memory) {
    // TODO: Implement
  }

  /// @inheritdoc ITransformer
  function calculateTransformToUnderlying(address _dependent, uint256 _amountDependent) external view returns (UnderlyingAmount[] memory) {
    // TODO: Implement
  }

  /// @inheritdoc ITransformer
  function calculateTransformToDependent(address _dependent, UnderlyingAmount[] calldata _underlying)
    external
    view
    returns (uint256 _amountDependent)
  {
    // TODO: Implement
  }

  /// @inheritdoc ITransformer
  function transformToUnderlying(
    address _dependent,
    uint256 _amountDependent,
    address _recipient
  ) external returns (UnderlyingAmount[] memory) {
    // TODO: Implement
  }

  /// @inheritdoc ITransformer
  function transformToDependent(
    address _dependent,
    UnderlyingAmount[] calldata _underlying,
    address _recipient
  ) external payable returns (uint256 _amountDependent) {
    // TODO: Implement
  }
}
