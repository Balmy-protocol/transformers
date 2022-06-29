// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

import './ITransformer.sol';

/**
 * @title A registry for all existing transformers
 * @notice This contract will contain all registered transformers and act as proxy. When called
 *         the registry will find the corresponding transformer and delegate the call to it. If no
 *         transformer is found, then it will fail
 */
interface ITransformerRegistry is ITransformer {
  /// @notice An association between a transformer, and some of its dependentes
  struct TransformerRegistration {
    address transformer;
    address[] dependents;
  }

  /**
   * @notice Thrown when trying to register a dependent to an address that is not a transformer
   * @param account The account that was not a transformer
   */
  error AddressIsNotTransformer(address account);

  /**
   * @notice Emitted when new dependents are registered
   * @param registrations The dependents that were registered
   */
  event TransformersRegistered(TransformerRegistration[] registrations);

  /**
   * @notice Returns the registered transformer for the given dependents
   * @param dependents The dependents to get the transformer for
   * @return The registered transformers, or the zero address if there isn't any
   */
  function transformers(address[] calldata dependents) external view returns (ITransformer[] memory);

  /**
   * @notice Sets a new registration for the given dependents
   * @dev Can only be called by admin
   * @param registrations The associations to register
   */
  function registerTransformers(TransformerRegistration[] calldata registrations) external;
}
