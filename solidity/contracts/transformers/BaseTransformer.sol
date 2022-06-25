// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7 <0.9.0;

import '../../interfaces/ITransformer.sol';
import '../utils/CollectableDust.sol';
import '../utils/Multicall.sol';

/// @title A base implementation of `ITransformer` that implements `CollectableDust` and `Multicall`
abstract contract BaseTransformer is CollectableDust, Multicall, ITransformer {

}
