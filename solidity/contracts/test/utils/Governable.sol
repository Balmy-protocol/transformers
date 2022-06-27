// SPDX-License-Identifier: UNLICENSED

pragma solidity >=0.8.7 <0.9.0;

import '../../utils/Governable.sol';

contract GovernableMock is Governable {
  constructor(address _governor) Governable(_governor) {}
}
