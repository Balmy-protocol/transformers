// SPDX-License-Identifier: UNLICENSED

pragma solidity >=0.8.22;

import '../../utils/Multicall.sol';

contract MulticallMock is Multicall {
  // slither-disable-next-line arbitrary-send
  function sendEthToAddress(address payable _recipient, uint256 _amount) external payable {
    _recipient.transfer(_amount);
  }
}
