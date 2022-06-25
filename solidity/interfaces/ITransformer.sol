// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;

/**
 * @title A contract that can map between one token and their underlying counterparts, and vice-versa
 * @notice This contract defines the concept of dependent tokens. These are tokens that depend on one or more underlying tokens,
 *         they can't exist on their own. This concept can apply to some known types of tokens, such as:
 *           - Wrappers (WETH/WMATIC/WBNB)
 *           - ERC-4626 tokens
 *           - LP tokens
 *         Now, transformers are smart contract that knows how to map dependent tokens into their underlying counterparts,
 *         and vice-versa. We are doing this so that we can abstract the way tokens can be transformed between each other
 */
interface ITransformer {
  /// @notice An amount of an underlying token
  struct UnderlyingAmount {
    address underlying;
    uint256 amount;
  }

  /**
   * @notice Returns the addresses of all the underlying tokens, for the given dependent
   * @param dependent The address of the dependent token
   * @return The addresses of all the underlying tokens
   */
  function getUnderlying(address dependent) external view returns (address[] memory);

  /**
   * @notice Calculates how much would the transformation to the underlying tokens return
   * @param dependent The address of the dependent token
   * @param amountDependent The amount to transform
   * @return The transformed amount in each of the underlying tokens
   */
  function calculateTransformToUnderlying(address dependent, uint256 amountDependent) external view returns (UnderlyingAmount[] memory);

  /**
   * @notice Calculates how much would the transformation to the dependent token return
   * @param dependent The address of the dependent token
   * @param underlying The amounts of underlying tokens to transform
   * @return amountDependent The transformed amount in the dependent token
   */
  function calculateTransformToDependent(address dependent, UnderlyingAmount[] calldata underlying)
    external
    view
    returns (uint256 amountDependent);

  /**
   * @notice Executes the transformation to the underlying tokens
   * @param dependent The address of the dependent token
   * @param amountDependent The amount to transform
   * @param recipient The address that would receive the underlying tokens
   * @return The transformed amount in each of the underlying tokens
   */
  function transformToUnderlying(
    address dependent,
    uint256 amountDependent,
    address recipient
  ) external returns (UnderlyingAmount[] memory);

  /**
   * @notice Executes the transformation to the dependent token
   * @param dependent The address of the dependent token
   * @param underlying The amounts of underlying tokens to transform
   * @param recipient The address that would receive the dependent tokens
   * @return amountDependent The transformed amount in the dependent token
   */
  function transformToDependent(
    address dependent,
    UnderlyingAmount[] calldata underlying,
    address recipient
  ) external payable returns (uint256 amountDependent);
}
