// SPDX-License-Identifier: UNLICENSED

pragma solidity >=0.8.22;

import '@openzeppelin/contracts/utils/introspection/IERC165.sol';
import '../../interfaces/ITransformer.sol';

// Note: necessary for smocking purposes
interface ITransformerERC165 is IERC165, ITransformer {

}
