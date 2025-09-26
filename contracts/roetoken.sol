// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ROEToken
 * @notice ERC20 token for the ROE Presale ecosystem.
 * @dev Mintable only by the presale contract (set via Ownable).
 */
contract ROEToken is ERC20, Ownable {
    address public presale;

    modifier onlyPresale() {
        require(msg.sender == presale, "Not presale contract");
        _;
    }

    constructor() ERC20("ROE Token", "ROE") Ownable() {}

    /// @notice One-time presale contract setter
    function setPresale(address _presale) external onlyOwner {
        require(_presale != address(0), "Invalid address");
        require(presale == address(0), "Presale already set");
        presale = _presale;
    }

    /// @notice Mint tokens (called by presale on claim)
    function mint(address to, uint256 amount) external onlyPresale {
        _mint(to, amount);
    }
}