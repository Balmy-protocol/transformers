// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.22;

import '@openzeppelin/contracts/utils/introspection/ERC165.sol';
import '../../interfaces/ITransformer.sol';

/// @title A base implementation of `ITransformer` that implements ERC-165
abstract contract BaseTransformer is ERC165, ITransformer {
  /// @inheritdoc IERC165
  function supportsInterface(bytes4 _interfaceId) public view virtual override returns (bool) {
    return _interfaceId == type(ITransformer).interfaceId || super.supportsInterface(_interfaceId);
  }

  modifier checkDeadline(uint256 _deadline) {
    if (block.timestamp > _deadline) revert TransactionExpired();
    _;
  }
}
