// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract UniToken is ERC20, Ownable {
    mapping(address => bool) private _whitelist;

    event WhitelistUpdated(address indexed account, bool allowed);

    constructor() 
        ERC20("Uni DAO Token", "UDT")
        Ownable(msg.sender)
    {
        // initial supply: 1,000,000 tokens
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
        _whitelist[msg.sender] = true;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        require(_whitelist[to], "Recipient not whitelisted");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }

    function setWhitelisted(address account, bool allowed) external onlyOwner {
        _whitelist[account] = allowed;
        emit WhitelistUpdated(account, allowed);
    }

    function isWhitelisted(address account) external view returns (bool) {
        return _whitelist[account];
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            require(_whitelist[from] && _whitelist[to], "Transfer restricted");
        }
        super._update(from, to, value);
    }
}
