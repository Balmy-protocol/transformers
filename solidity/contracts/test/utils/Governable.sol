// SPDX-License-Identifier: UNLICENSED

pragma solidity >=0.8.22;

import '../../utils/Governable.sol';

contract GovernableMock is Governable {
  constructor(address _governor) Governable(_governor) {}
}
