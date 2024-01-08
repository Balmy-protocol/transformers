// SPDX-License-Identifier: UNLICENSED

pragma solidity >=0.8.22;

import '../../utils/CollectableDust.sol';

contract CollectableDustMock is CollectableDust {
  constructor(address _governor) Governable(_governor) {}
}
