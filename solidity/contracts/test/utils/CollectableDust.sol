// SPDX-License-Identifier: UNLICENSED

pragma solidity >=0.8.7 <0.9.0;

import '../../utils/CollectableDust.sol';

contract CollectableDustMock is CollectableDust {
  constructor(address _governor) Governable(_governor) {}
}
